import { useMutation, useQuery } from "@tanstack/react-query";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  latencyMs?: number;
}

export type ValidationResults = Record<string, ValidationResult>;

export function useValidateApiKeys() {
  return useMutation({
    mutationFn: async (): Promise<ValidationResults> => {
      const response = await fetch("/api/validate-keys", {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
  });
}

export function useApiKeyValidation() {
  return useQuery({
    queryKey: ["api-key-validation"],
    queryFn: async (): Promise<ValidationResults> => {
      const response = await fetch("/api/validate-keys", {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: false, // Only run when explicitly requested
  });
}