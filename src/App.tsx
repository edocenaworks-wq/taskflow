/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useMemo, ChangeEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, Moon, Sun, Download, X, Upload, Bell, Calendar as CalendarIcon, Clock, Edit2, Save } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  categoryId?: string;
  dueDate?: string; // ISO string
  reminderTime?: string; // ISO string
  reminderId?: number;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Work', color: '#515C97' },
  { id: '2', name: 'Personal', color: '#10b981' },
  { id: '3', name: 'Urgent', color: '#ef4444' },
];

const COLORS = [
  { name: 'Indigo', value: '#515C97' },
  { name: 'Red', value: '#db2929' },
  { name: 'Original', value: '#1A1A1A' },
];

const CURRENT_VERSION = '1.0.0';
const TASK_ACTION_TYPE = 'TASK_REMINDER_ACTIONS';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  // Use ref to keep track of latest todos for the notification listener
  const todosRef = useRef<Todo[]>([]);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const [categories, setCategories] = useState<Category[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskflow-categories');
      return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
    }
    return DEFAULT_CATEGORIES;
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>('all');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [reassignCategoryId, setReassignCategoryId] = useState<string | 'none'>('none');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [reminderTime, setReminderTime] = useState<string>('');
  const [isSettingReminder, setIsSettingReminder] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; notes: string; url: string } | null>(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  const [primaryColor, setPrimaryColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('taskflow-primary') || '#515C97';
    }
    return '#515C97';
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskflow-theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Handle color changes
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    localStorage.setItem('taskflow-primary', primaryColor);
  }, [primaryColor]);

  // Load todos from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('taskflow-todos');
    if (saved) {
      try {
        setTodos(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse todos', e);
      }
    }
  }, []);

  // Save todos to localStorage on change
  useEffect(() => {
    localStorage.setItem('taskflow-todos', JSON.stringify(todos));
  }, [todos]);

  // Save categories to localStorage
  useEffect(() => {
    localStorage.setItem('taskflow-categories', JSON.stringify(categories));
  }, [categories]);

  // Handle theme changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('taskflow-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('taskflow-theme', 'light');
    }
  }, [isDarkMode]);

  const scheduleNotification = async (todo: Todo, timeStr: string) => {
    if (!timeStr) return undefined;
    
    const scheduleDate = new Date(timeStr);
    if (isNaN(scheduleDate.getTime()) || scheduleDate.getTime() <= Date.now()) {
      return undefined;
    }

    const id = Math.floor(Math.random() * 1000000);
    
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Task Reminder',
            body: todo.text,
            id: id,
            schedule: { at: scheduleDate },
            sound: 'default',
            actionTypeId: TASK_ACTION_TYPE,
            extra: { todoId: todo.id }
          },
        ],
      });
      return id;
    } catch (e) {
      console.error('Failed to schedule notification', e);
      return undefined;
    }
  };

  const cancelNotification = async (id?: number) => {
    if (id === undefined) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (e) {
      console.error('Failed to cancel notification', e);
    }
  };

  // Request notification permissions and setup actions/listeners
  useEffect(() => {
    let notificationListener: any;

    const setupNotifications = async () => {
      try {
        await LocalNotifications.requestPermissions();

        // Define actions for notifications
        await LocalNotifications.setActions({
          types: [
            {
              id: TASK_ACTION_TYPE,
              actions: [
                { id: 'complete', title: 'Completata', foreground: true },
                { id: 'snooze', title: 'Posticipa (30m)', foreground: true }
              ]
            }
          ]
        });

        // Handle action performed
        notificationListener = await LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
          const { actionId, notification } = action;
          const todoId = notification.extra?.todoId;

          if (!todoId) return;

          if (actionId === 'complete') {
            setTodos(prev => prev.map(t => t.id === todoId ? { ...t, completed: true } : t));
          } else if (actionId === 'snooze') {
            const todoToSnooze = todosRef.current.find(t => t.id === todoId);
            if (todoToSnooze) {
              const snoozeTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
              const newId = await scheduleNotification(todoToSnooze, snoozeTime);
              setTodos(prev => prev.map(t => t.id === todoId ? {
                ...t,
                reminderTime: snoozeTime,
                reminderId: newId
              } : t));
            }
          }
        });
      } catch (e) {
        console.error('Failed to setup notifications', e);
      }
    };

    setupNotifications();

    return () => {
      if (notificationListener) {
        notificationListener.remove();
      }
    };
  }, []);

  // Check for updates
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // Fetch from the shared app URL or relative path
        const response = await fetch('/version.json');
        if (response.ok) {
          const data = await response.json();
          if (data.version && data.version !== CURRENT_VERSION) {
            setUpdateInfo(data);
            setShowUpdatePopup(true);
          }
        }
      } catch (e) {
        console.error('Failed to check for updates', e);
      }
    };

    // Check on mount
    checkForUpdates();
  }, []);

  const addTodo = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    if (editingTodoId) {
      // Update existing todo
      const existingTodo = todos.find(t => t.id === editingTodoId);
      if (!existingTodo) return;

      // If reminder or text changed, cancel old and schedule new
      let newReminderId = existingTodo.reminderId;
      if (reminderTime !== existingTodo.reminderTime || inputValue.trim() !== existingTodo.text) {
        if (existingTodo.reminderId) {
          await cancelNotification(existingTodo.reminderId);
        }
        if (reminderTime) {
          newReminderId = await scheduleNotification({ ...existingTodo, text: inputValue.trim() }, reminderTime);
        } else {
          newReminderId = undefined;
        }
      }

      setTodos(todos.map(t => t.id === editingTodoId ? {
        ...t,
        text: inputValue.trim(),
        categoryId: selectedCategoryId || undefined,
        dueDate: dueDate || undefined,
        reminderTime: reminderTime || undefined,
        reminderId: newReminderId
      } : t));

      setEditingTodoId(null);
    } else {
      // Add new todo
      const todoId = window.crypto.randomUUID();
      const newTodoBase: Todo = {
        id: todoId,
        text: inputValue.trim(),
        completed: false,
        createdAt: Date.now(),
        categoryId: selectedCategoryId || undefined,
        dueDate: dueDate || undefined,
        reminderTime: reminderTime || undefined,
      };

      let reminderId: number | undefined = undefined;
      if (reminderTime) {
        reminderId = await scheduleNotification(newTodoBase, reminderTime);
      }

      const newTodo: Todo = {
        ...newTodoBase,
        reminderId,
      };

      setTodos([newTodo, ...todos]);
    }

    setInputValue('');
    setSelectedCategoryId(null);
    setDueDate('');
    setReminderTime('');
    setIsSettingReminder(false);
  };

  const startEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setInputValue(todo.text);
    setSelectedCategoryId(todo.categoryId || null);
    setDueDate(todo.dueDate || '');
    setReminderTime(todo.reminderTime || ''); 
    setIsSettingReminder(!!(todo.dueDate || todo.reminderTime));
    
    // Scroll to top to see the edit form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setInputValue('');
    setSelectedCategoryId(null);
    setDueDate('');
    setReminderTime('');
    setIsSettingReminder(false);
  };

  const addCategory = (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const newCategory: Category = {
      id: window.crypto.randomUUID(),
      name: newCategoryName.trim(),
      color: primaryColor, // Use current primary color for new categories
    };

    setCategories([...categories, newCategory]);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const updateCategory = (e: FormEvent) => {
    e.preventDefault();
    if (!editingCategoryId || !newCategoryName.trim()) return;

    setCategories(categories.map(c => 
      c.id === editingCategoryId 
        ? { ...c, name: newCategoryName.trim(), color: primaryColor } 
        : c
    ));
    
    setEditingCategoryId(null);
    setNewCategoryName('');
  };

  const startEditingCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setNewCategoryName(cat.name);
    setPrimaryColor(cat.color);
    setIsAddingCategory(false);
  };

  const deleteCategory = () => {
    if (!categoryToDelete) return;

    const id = categoryToDelete;
    setCategories(categories.filter(c => c.id !== id));
    
    // Reassign or remove category from todos
    setTodos(todos.map(t => {
      if (t.categoryId === id) {
        return { ...t, categoryId: reassignCategoryId === 'none' ? undefined : reassignCategoryId };
      }
      return t;
    }));

    if (filterCategoryId === id) setFilterCategoryId('all');
    if (selectedCategoryId === id) setSelectedCategoryId(null);
    
    setCategoryToDelete(null);
    setReassignCategoryId('none');
  };

  const filteredTodos = useMemo(() => {
    if (filterCategoryId === 'all') return todos;
    return todos.filter(todo => todo.categoryId === filterCategoryId);
  }, [todos, filterCategoryId]);

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => {
      if (todo.id === id) {
        const newCompleted = !todo.completed;
        // If completed, cancel reminder
        if (newCompleted && todo.reminderId) {
          cancelNotification(todo.reminderId);
        }
        return { ...todo, completed: newCompleted };
      }
      return todo;
    }));
  };

  const deleteTodo = (id: string) => {
    const todoToDelete = todos.find(t => t.id === id);
    if (todoToDelete?.reminderId) {
      cancelNotification(todoToDelete.reminderId);
    }
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const completedCount = filteredTodos.filter(t => t.completed).length;

  const exportData = async () => {
    const data = {
      todos,
      categories,
      primaryColor,
      isDarkMode
    };
    const fileName = `taskflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    const jsonString = JSON.stringify(data, null, 2);

    if (Capacitor.isNativePlatform()) {
      try {
        // On native platforms, save to file and share
        const result = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        await Share.share({
          title: 'TaskFlow Backup',
          text: 'Here is your TaskFlow backup file.',
          url: result.uri,
          dialogTitle: 'Export Backup',
        });
      } catch (e) {
        console.error('Failed to export on native platform', e);
        alert('Failed to export backup.');
      }
    } else {
      // Standard web export
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const importData = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.todos) setTodos(data.todos);
        if (data.categories) setCategories(data.categories);
        if (data.primaryColor) setPrimaryColor(data.primaryColor);
        if (data.isDarkMode !== undefined) setIsDarkMode(data.isDarkMode);
        alert('Data imported successfully!');
      } catch (err) {
        console.error('Failed to import data', err);
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-gray-200 dark:selection:bg-gray-700">
      <div className="max-w-2xl mx-auto px-6 py-20">
        {/* Header Section */}
        <header className="mb-12 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest opacity-50">TaskFlow</span>
            </div>
            <h1 className="text-5xl font-light tracking-tight">Focus on what matters.</h1>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="flex items-center gap-4">
              {/* Color Selector */}
              <div id="color-selector" className="flex items-center gap-2 p-1.5 bg-white dark:bg-[#2D2D2D] rounded-full shadow-sm">
                {COLORS.map((color) => (
                  <button
                    id={`color-btn-${color.name.toLowerCase()}`}
                    key={color.value}
                    onClick={() => setPrimaryColor(color.value)}
                    className={`w-5 h-5 rounded-full transition-all hover:scale-110 active:scale-90 ${primaryColor === color.value ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : 'opacity-60 hover:opacity-100'}`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    aria-label={`Change theme to ${color.name}`}
                  />
                ))}
              </div>

              <button
                id="theme-toggle-btn"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-3 bg-white dark:bg-[#2D2D2D] rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all"
                aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-primary" />}
              </button>
            </div>
            <div className="text-right">
              <div className="text-3xl font-light leading-none">{todos.length}</div>
              <div className="text-[10px] uppercase tracking-wider opacity-50">Total Tasks</div>
            </div>
          </div>
        </header>

        {/* Category Filter Bar */}
        <div className="mb-8 flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setFilterCategoryId('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium transition-all ${filterCategoryId === 'all' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-[#2D2D2D] opacity-60 hover:opacity-100'}`}
          >
            All Tasks
          </button>
          {categories.map((cat) => (
            <div key={cat.id} className="relative group flex-shrink-0">
              <button
                onClick={() => setFilterCategoryId(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${filterCategoryId === cat.id ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-[#2D2D2D] opacity-60 hover:opacity-100'}`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
              <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity scale-75">
                <button 
                  onClick={() => startEditingCategory(cat)}
                  className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  title="Edit Category"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setCategoryToDelete(cat.id)}
                  className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  title="Delete Category"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setIsAddingCategory(!isAddingCategory)}
            className="flex-shrink-0 p-2 bg-white dark:bg-[#2D2D2D] rounded-xl opacity-60 hover:opacity-100 transition-all"
            title="Add Category"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Add/Edit Category Form */}
        <AnimatePresence>
          {(isAddingCategory || editingCategoryId) && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={editingCategoryId ? updateCategory : addCategory}
              className="mb-8 overflow-hidden"
            >
              <div className="flex flex-col gap-4 p-4 bg-white dark:bg-[#2D2D2D] rounded-2xl shadow-sm border border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-50">
                    {editingCategoryId ? 'Edit Tag' : 'New Tag'}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAddingCategory(false);
                      setEditingCategoryId(null);
                      setNewCategoryName('');
                    }} 
                    className="p-1 opacity-50 hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Tag name..."
                    className="flex-1 bg-transparent border-none outline-none text-sm"
                  />
                  <button type="submit" className="p-2 bg-primary text-white rounded-lg flex items-center gap-2 text-xs font-medium">
                    {editingCategoryId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingCategoryId ? 'Update' : 'Add'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider opacity-40">Color:</span>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setPrimaryColor(color.value)}
                        className={`w-4 h-4 rounded-full transition-all ${primaryColor === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : 'opacity-60'}`}
                        style={{ backgroundColor: color.value }}
                        aria-label={`Select ${color.name} color`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Delete Category Confirmation Modal */}
        <AnimatePresence>
          {categoryToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm bg-white dark:bg-[#2D2D2D] rounded-3xl p-8 shadow-2xl"
              >
                <h3 className="text-xl font-semibold mb-2">Delete Tag?</h3>
                <p className="text-sm opacity-60 mb-6">
                  What should happen to the tasks in this tag?
                </p>
                
                <div className="space-y-3 mb-8">
                  <button
                    onClick={() => setReassignCategoryId('none')}
                    className={`w-full p-4 rounded-2xl text-left text-sm transition-all border ${reassignCategoryId === 'none' ? 'border-primary bg-primary/5' : 'border-transparent bg-gray-50 dark:bg-gray-800'}`}
                  >
                    <div className="font-medium">Remove Tag</div>
                    <div className="text-xs opacity-40">Tasks will have no tag</div>
                  </button>
                  
                  {categories.filter(c => c.id !== categoryToDelete).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase tracking-wider opacity-40 ml-1">Move to:</span>
                      <div className="flex flex-wrap gap-2">
                        {categories.filter(c => c.id !== categoryToDelete).map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setReassignCategoryId(cat.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 border ${reassignCategoryId === cat.id ? 'border-primary bg-primary/5' : 'border-transparent bg-gray-50 dark:bg-gray-800'}`}
                          >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCategoryToDelete(null)}
                    className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteCategory}
                    className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-medium text-sm"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Section */}
        <div className="mb-12 space-y-4">
          <form onSubmit={addTodo} className="relative group">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={editingTodoId ? "Update task..." : "What's next?"}
              className="w-full bg-white dark:bg-[#2D2D2D] border-none rounded-2xl px-6 py-5 text-lg shadow-sm focus:ring-2 focus:ring-primary transition-all duration-300 outline-none placeholder:opacity-30"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {editingTodoId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl transition-all hover:scale-105 active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="p-3 bg-primary text-white rounded-xl disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                {editingTodoId ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </button>
            </div>
          </form>

          {/* Task Options (Category, Due Date, Reminder) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar flex-grow">
              <span className="text-[10px] uppercase tracking-wider opacity-40 mr-2">Tag:</span>
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${!selectedCategoryId ? 'bg-gray-200 dark:bg-gray-700 opacity-100' : 'opacity-40 hover:opacity-60'}`}
              >
                None
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${selectedCategoryId === cat.id ? 'bg-primary/20 text-primary opacity-100' : 'opacity-40 hover:opacity-60'}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Due Date & Reminder Buttons */}
            <div className="flex items-center gap-2 pb-2">
              <div className="relative">
                <button
                  onClick={() => setIsSettingReminder(!isSettingReminder)}
                  className={`p-2 rounded-xl transition-all ${dueDate || reminderTime ? 'bg-primary/10 text-primary' : 'bg-white dark:bg-[#2D2D2D] opacity-60 hover:opacity-100'}`}
                  title="Set Due Date & Reminder"
                >
                  <Bell className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Reminder/Due Date Form */}
          <AnimatePresence>
            {isSettingReminder && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white dark:bg-[#2D2D2D] rounded-2xl shadow-sm border border-primary/10">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-50">
                      <CalendarIcon className="w-3 h-3" />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-[#1A1A1A] border-none rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-50">
                      <Clock className="w-3 h-3" />
                      Reminder
                    </label>
                    <input
                      type="datetime-local"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-[#1A1A1A] border-none rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider opacity-50">
                {filterCategoryId === 'all' ? 'Completed' : `${categories.find(c => c.id === filterCategoryId)?.name} Tasks`}
              </span>
              <span className="text-sm font-medium">{completedCount} of {filteredTodos.length}</span>
            </div>
          </div>
          {filteredTodos.length > 0 && (
             <div className="h-1 flex-1 mx-8 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / filteredTodos.length) * 100}%` }}
                />
             </div>
          )}
        </div>

        {/* Todo List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredTodos.map((todo) => {
              const category = categories.find(c => c.id === todo.categoryId);
              return (
                <motion.div
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  className={`group flex items-center gap-4 bg-white dark:bg-[#2D2D2D] p-4 rounded-2xl shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all duration-300 ${todo.completed ? 'opacity-60' : ''}`}
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="flex-shrink-0 transition-transform hover:scale-110 active:scale-90"
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                    )}
                  </button>
                  
                  <div 
                    className="flex-grow flex flex-col gap-1 cursor-pointer"
                    onClick={() => startEditing(todo)}
                  >
                    <span className={`text-lg transition-all duration-300 ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                      {todo.text}
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      {category && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40">{category.name}</span>
                        </div>
                      )}
                      {todo.dueDate && (
                        <div className="flex items-center gap-1.5 opacity-40">
                          <CalendarIcon className="w-3 h-3" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">
                            {new Date(todo.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      {todo.reminderId && !todo.completed && (
                        <div className="flex items-center gap-1.5 text-primary/60">
                          <Bell className="w-3 h-3" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Reminder Set</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditing(todo)}
                      className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
                      title="Edit Task"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-lg transition-all duration-200"
                      title="Delete Task"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredTodos.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-[#2D2D2D] mb-4">
                <ListTodo className="w-8 h-8 text-gray-300 dark:text-gray-700" />
              </div>
              <p className="text-gray-400 dark:text-gray-600 font-light">
                {filterCategoryId === 'all' 
                  ? "Your list is empty. Add a task to get started." 
                  : `No tasks found in ${categories.find(c => c.id === filterCategoryId)?.name}.`}
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2D2D2D] rounded-xl text-xs font-medium opacity-60 hover:opacity-100 transition-all"
                title="Export Data"
              >
                <Download className="w-4 h-4" />
                Export Backup
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#2D2D2D] rounded-xl text-xs font-medium opacity-60 hover:opacity-100 transition-all cursor-pointer">
                <Upload className="w-4 h-4" />
                Import Backup
                <input type="file" accept=".json" onChange={importData} className="hidden" />
              </label>
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-30">
              Built with precision & simplicity
            </p>
          </div>
        </footer>
      </div>

      {/* Update Available Popup */}
      <AnimatePresence>
        {showUpdatePopup && updateInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-white dark:bg-[#2D2D2D] rounded-[32px] p-8 shadow-2xl border border-primary/20"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Download className="w-8 h-8 text-primary" />
              </div>
              
              <h3 className="text-2xl font-semibold text-center mb-2">Update Available</h3>
              <p className="text-center text-sm opacity-60 mb-6">
                A new version of TaskFlow is ready. 
                <span className="block mt-1 font-medium text-primary">v{updateInfo.version}</span>
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-8">
                <span className="text-[10px] uppercase tracking-wider opacity-40 block mb-2">What's New:</span>
                <p className="text-xs leading-relaxed opacity-80">
                  {updateInfo.notes}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href={updateInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl bg-primary text-white font-semibold text-center shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Download Now
                </a>
                <button
                  onClick={() => setShowUpdatePopup(false)}
                  className="w-full py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-medium text-sm hover:opacity-80 transition-all"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
