import { useState, useEffect } from 'react';
import { Search, Filter, BookOpen, Sparkles } from 'lucide-react';
import { 
  getAllPrompts, 
  searchPrompts, 
  promptCategories,
  getPopularTags,
  getPromptsCount
} from '../data/prompt-library';
import { PromptTemplate, PromptSearchFilters } from '../data/prompt-library/types';
import PromptCard from '../components/prompts/PromptCard';
import PromptDetails from '../components/prompts/PromptDetails';

export default function PromptLibrary() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [filters, setFilters] = useState<PromptSearchFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [popularTags, setPopularTags] = useState<string[]>([]);

  useEffect(() => {
    // Load initial data
    setPrompts(getAllPrompts());
    setStats(getPromptsCount());
    setPopularTags(getPopularTags());
  }, []);

  useEffect(() => {
    // Apply filters
    const filtered = searchPrompts({ ...filters, searchQuery });
    setPrompts(filtered);
  }, [filters, searchQuery]);

  const handleCategorySelect = (categoryId: string) => {
    if (categoryId === 'all') {
      setFilters({});
    } else {
      setFilters({ ...filters, category: categoryId });
    }
  };

  const handleTagSelect = (tag: string) => {
    const currentTags = filters.tags || [];
    if (currentTags.includes(tag)) {
      setFilters({
        ...filters,
        tags: currentTags.filter(t => t !== tag)
      });
    } else {
      setFilters({
        ...filters,
        tags: [...currentTags, tag]
      });
    }
  };

  const handleDifficultySelect = (difficulty: string) => {
    if (filters.difficulty === difficulty) {
      const { difficulty: _, ...rest } = filters;
      setFilters(rest);
    } else {
      setFilters({ ...filters, difficulty });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Prompt Library
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {stats?.total || 0} automation templates across {promptCategories.length} categories
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search prompts by title, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block w-64 flex-shrink-0`}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
              {/* Categories */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Categories
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => handleCategorySelect('all')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                      !filters.category
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    All Categories
                  </button>
                  {promptCategories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                        filters.category === category.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>{category.icon}</span>
                      <span className="truncate">{category.name}</span>
                      <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                        {stats?.byCategory[category.id] || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Difficulty
                </h3>
                <div className="space-y-2">
                  {['beginner', 'intermediate', 'advanced'].map(level => (
                    <button
                      key={level}
                      onClick={() => handleDifficultySelect(level)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm capitalize ${
                        filters.difficulty === level
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {level}
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        ({stats?.byDifficulty[level] || 0})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Popular Tags */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Popular Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {popularTags.slice(0, 10).map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleTagSelect(tag)}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        filters.tags?.includes(tag)
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Active Filters */}
            {(filters.category || filters.tags?.length || filters.difficulty) && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 dark:text-gray-400">Active filters:</span>
                {filters.category && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {promptCategories.find(c => c.id === filters.category)?.name}
                    <button
                      onClick={() => setFilters({ ...filters, category: undefined })}
                      className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.difficulty && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 capitalize">
                    {filters.difficulty}
                    <button
                      onClick={() => handleDifficultySelect(filters.difficulty!)}
                      className="ml-1 hover:text-green-900 dark:hover:text-green-100"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    #{tag}
                    <button
                      onClick={() => handleTagSelect(tag)}
                      className="ml-1 hover:text-purple-900 dark:hover:text-purple-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setFilters({})}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Results */}
            {prompts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No prompts found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your filters or search query
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {prompts.map(prompt => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => setSelectedPrompt(prompt)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prompt Details Modal */}
      {selectedPrompt && (
        <PromptDetails
          prompt={selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
        />
      )}
    </div>
  );
}