/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, Moon, Sun, Download } from 'lucide-react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskflow-theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Handle PWA installation
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
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
    };

    setTodos([newTodo, ...todos]);
    setInputValue('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const completedCount = todos.filter(t => t.completed).length;

  return (
    <div className="min-h-screen font-sans selection:bg-primary selection:text-white">
      <div className="max-w-2xl mx-auto px-6 py-20">
        {/* Header Section */}
        <header className="mb-12 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ListTodo className="w-6 h-6" />
              <span className="text-xs font-semibold uppercase tracking-widest opacity-50">TaskFlow</span>
            </div>
            <h1 className="text-5xl font-light tracking-tight">Focus on what matters.</h1>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="flex items-center gap-2">
              {showInstallBtn && (
                <button
                  onClick={handleInstallClick}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all text-xs font-medium"
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
              )}
              <button
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

        {/* Input Section */}
        <form onSubmit={addTodo} className="relative mb-12 group">
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

        {/* Stats Bar */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider opacity-50">Completed</span>
              <span className="text-sm font-medium">{completedCount} of {todos.length}</span>
            </div>
          </div>
          {todos.length > 0 && (
             <div className="h-1 flex-1 mx-8 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / todos.length) * 100}%` }}
                />
             </div>
          )}
        </div>

        {/* Todo List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {todos.map((todo) => (
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
                
                <span className={`flex-grow text-lg transition-all duration-300 ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                  {todo.text}
                </span>

                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-lg transition-all duration-200"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {todos.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-[#2D2D2D] mb-4">
                <ListTodo className="w-8 h-8 text-gray-300 dark:text-gray-700" />
              </div>
              <p className="text-gray-400 dark:text-gray-600 font-light">Your list is empty. Add a task to get started.</p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-30">
            Built with precision & simplicity
          </p>
        </footer>
      </div>
    </div>
  );
}
