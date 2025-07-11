import { useState, useCallback, useEffect } from 'react';
import { apiClient, APIResponse } from '../services/api-client';

export interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: any | null;
  success: boolean;
}

export function useApi<T = any>(
  apiCall: (...args: any[]) => Promise<APIResponse<T>>,
  options: UseApiOptions = {}
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
    success: false
  });

  const execute = useCallback(async (...args: any[]) => {
    setState(prev => ({ ...prev, loading: true, error: null, success: false }));

    try {
      const response = await apiCall(...args);
      
      if (response.success) {
        setState({
          data: response.data!,
          loading: false,
          error: null,
          success: true
        });
        
        if (options.onSuccess) {
          options.onSuccess(response.data);
        }
        
        return response.data;
      } else {
        const error = response.error || { code: 'UNKNOWN_ERROR', message: 'Unknown error occurred' };
        setState({
          data: null,
          loading: false,
          error,
          success: false
        });
        
        if (options.onError) {
          options.onError(error);
        }
        
        throw error;
      }
    } catch (error: any) {
      const apiError = error.response?.data?.error || error;
      
      setState({
        data: null,
        loading: false,
        error: apiError,
        success: false
      });
      
      if (options.onError) {
        options.onError(apiError);
      }
      
      throw apiError;
    }
  }, [apiCall, options]);

  useEffect(() => {
    if (options.immediate) {
      execute();
    }
  }, [execute, options.immediate]);

  return {
    ...state,
    execute,
    reset: () => setState({
      data: null,
      loading: false,
      error: null,
      success: false
    })
  };
}

// Specialized hooks for common API operations
export function useCredentials(options?: UseApiOptions) {
  return useApi(apiClient.getCredentials.bind(apiClient), options);
}

export function useCreateCredential(options?: UseApiOptions) {
  return useApi(apiClient.createCredential.bind(apiClient), options);
}

export function useUpdateCredential(options?: UseApiOptions) {
  return useApi(apiClient.updateCredential.bind(apiClient), options);
}

export function useDeleteCredential(options?: UseApiOptions) {
  return useApi(apiClient.deleteCredential.bind(apiClient), options);
}

export function useUsageStats(options?: UseApiOptions) {
  return useApi(apiClient.getUsageStats.bind(apiClient), options);
}

export function useCostAnalysis(options?: UseApiOptions) {
  return useApi(apiClient.getCostAnalysis.bind(apiClient), options);
}

// Paginated data hook
export function usePaginatedApi<T = any>(
  apiCall: (params: any) => Promise<APIResponse<T[]>>,
  initialParams: any = {}
) {
  const [params, setParams] = useState(initialParams);
  const [allData, setAllData] = useState<T[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  const { data, loading, error, execute } = useApi(apiCall, {
    onSuccess: (response) => {
      if (params.page === 1) {
        setAllData(response.data || []);
      } else {
        setAllData(prev => [...prev, ...(response.data || [])]);
      }
      
      if (response.pagination) {
        setPagination(response.pagination);
      }
    }
  });

  const loadMore = useCallback(() => {
    if (pagination.page < pagination.totalPages && !loading) {
      const nextParams = { ...params, page: pagination.page + 1 };
      setParams(nextParams);
      execute(nextParams);
    }
  }, [params, pagination, loading, execute]);

  const reload = useCallback(() => {
    const resetParams = { ...params, page: 1 };
    setParams(resetParams);
    setAllData([]);
    execute(resetParams);
  }, [params, execute]);

  const updateParams = useCallback((newParams: any) => {
    const updatedParams = { ...params, ...newParams, page: 1 };
    setParams(updatedParams);
    setAllData([]);
    execute(updatedParams);
  }, [params, execute]);

  useEffect(() => {
    execute(params);
  }, []);

  return {
    data: allData,
    loading,
    error,
    pagination,
    loadMore,
    reload,
    updateParams,
    hasMore: pagination.page < pagination.totalPages
  };
}