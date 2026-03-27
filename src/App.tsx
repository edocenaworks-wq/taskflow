/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, Moon, Sun, Download, Tag, Filter, X, ChevronDown, Upload, FileJson } from 'lucide-react';

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
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Work', color: '#515C97' },
  { id: '2', name: 'Personal', color: '#10b981' },
  { id: '3', name: 'Urgent', color: '#ef4444' },
];

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  
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
  const [newCategoryName, setNewCategoryName] = useState('');

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

  const colors = [
    { name: 'Indigo', value: '#515C97' },
    { name: 'Red', value: '#db2929' },
    { name: 'Original', value: '#1A1A1A' },
  ];

  // Handle color changes
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    localStorage.setItem('taskflow-primary', primaryColor);
  }, [primaryColor]);

  const [isIOS, setIsIOS] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const [isStandalone, setIsStandalone] = useState(false);

  // Handle PWA installation
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already in standalone mode or native
    const isNative = Capacitor.isNativePlatform();
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true || isNative;
    setIsStandalone(standalone);
    if (standalone || isNative) {
      setShowInstallBtn(false);
    } else {
      // If not standalone and not native, we can show the button even if prompt hasn't fired yet
      // but we'll use it to show instructions
      setShowInstallBtn(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallBtn(false);
      }
    } else {
      setShowInstallModal(true);
    }
  };

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

  const addTodo = (e?: FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: inputValue.trim(),
      completed: false,
      createdAt: Date.now(),
      categoryId: selectedCategoryId || undefined,
    };

    setTodos([newTodo, ...todos]);
    setInputValue('');
    setSelectedCategoryId(null);
  };

  const addCategory = (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const newCategory: Category = {
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      color: primaryColor, // Use current primary color for new categories
    };

    setCategories([...categories, newCategory]);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter(c => c.id !== id));
    // Also remove this category from todos
    setTodos(todos.map(t => t.categoryId === id ? { ...t, categoryId: undefined } : t));
    if (filterCategoryId === id) setFilterCategoryId('all');
    if (selectedCategoryId === id) setSelectedCategoryId(null);
  };

  const filteredTodos = useMemo(() => {
    if (filterCategoryId === 'all') return todos;
    return todos.filter(todo => todo.categoryId === filterCategoryId);
  }, [todos, filterCategoryId]);

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const completedCount = filteredTodos.filter(t => t.completed).length;

  const exportData = () => {
    const data = {
      todos,
      categories,
      primaryColor,
      isDarkMode
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.todos) setTodos(data.todos);
        if (data.categories) setCategories(data.categories);
        if (data.primaryColor) setPrimaryColor(data.primaryColor);
        if (data.isDarkMode) setIsDarkMode(data.isDarkMode);
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
                {colors.map((color, index) => (
                  <button
                    id={`color-btn-${color.name.toLowerCase()}`}
                    key={color.value}
                    onClick={() => setPrimaryColor(color.value)}
                    className={`w-5 h-5 rounded-full transition-all hover:scale-110 active:scale-90 ${primaryColor === color.value ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : 'opacity-60 hover:opacity-100'}`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
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

        {/* Install Modal */}
        <AnimatePresence>
          {showInstallModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-md bg-white dark:bg-[#2D2D2D] rounded-3xl p-8 shadow-2xl"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-primary/10 rounded-2xl">
                    <Download className="w-6 h-6 text-primary" />
                  </div>
                  <button onClick={() => setShowInstallModal(false)} className="p-2 opacity-40 hover:opacity-100 transition-opacity">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <h2 className="text-2xl font-semibold mb-2">Install TaskFlow</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                  Install TaskFlow on your device for a better experience, offline access, and quick launch from your home screen.
                </p>

                {isIOS ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <div className="flex-shrink-0 w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-sm font-bold">1</span>
                      </div>
                      <p className="text-sm">Tap the <span className="font-bold">Share</span> button in Safari.</p>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <div className="flex-shrink-0 w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-sm font-bold">2</span>
                      </div>
                      <p className="text-sm">Scroll down and tap <span className="font-bold">"Add to Home Screen"</span>.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <div className="flex-shrink-0 w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-sm font-bold">1</span>
                      </div>
                      <p className="text-sm">Click the <span className="font-bold">Install</span> button in your browser's address bar or menu.</p>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <div className="flex-shrink-0 w-8 h-8 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-sm font-bold">2</span>
                      </div>
                      <p className="text-sm">Confirm the installation when prompted.</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowInstallModal(false)}
                  className="w-full mt-8 py-4 bg-primary text-white rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Got it
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
              <button 
                onClick={() => deleteCategory(cat.id)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75"
              >
                <X className="w-3 h-3" />
              </button>
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

        {/* Add Category Form */}
        <AnimatePresence>
          {isAddingCategory && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={addCategory}
              className="mb-8 overflow-hidden"
            >
              <div className="flex gap-2 p-4 bg-white dark:bg-[#2D2D2D] rounded-2xl shadow-sm border border-primary/20">
                <input
                  autoFocus
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name..."
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                />
                <button type="submit" className="p-2 bg-primary text-white rounded-lg">
                  <Plus className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setIsAddingCategory(false)} className="p-2 opacity-50">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Input Section */}
        <div className="mb-12 space-y-4">
          <form onSubmit={addTodo} className="relative group">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="What's next?"
              className="w-full bg-white dark:bg-[#2D2D2D] border-none rounded-2xl px-6 py-5 text-lg shadow-sm focus:ring-2 focus:ring-primary transition-all duration-300 outline-none placeholder:opacity-30"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-primary text-white rounded-xl disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {/* Category Selector for New Task */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
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
                  
                  <div className="flex-grow flex flex-col gap-1">
                    <span className={`text-lg transition-all duration-300 ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                      {todo.text}
                    </span>
                    {category && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40">{category.name}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-lg transition-all duration-200"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
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
    </div>
  );
}
