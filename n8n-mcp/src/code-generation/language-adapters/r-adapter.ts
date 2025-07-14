import { CodeGenerationRequest, CodeContext } from '../types.js';
import { AIService } from '../../ai-service.js';

export interface RCodeGenerationOptions {
  libraries?: string[];
  tidyverse?: boolean;
  includeVisualization?: boolean;
  outputFormat?: 'dataframe' | 'list' | 'json' | 'csv';
  statisticalAnalysis?: boolean;
  parallel?: boolean;
}

export class RCodeAdapter {
  private aiService: AIService;
  private commonLibraries: Map<string, string[]>;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.initializeCommonLibraries();
  }

  private initializeCommonLibraries() {
    this.commonLibraries = new Map([
      ['data_manipulation', ['dplyr', 'tidyr', 'purrr']],
      ['visualization', ['ggplot2', 'plotly', 'ggvis']],
      ['statistics', ['stats', 'MASS', 'car', 'lme4']],
      ['machine_learning', ['caret', 'randomForest', 'xgboost', 'glmnet']],
      ['time_series', ['forecast', 'tseries', 'zoo', 'xts']],
      ['text_processing', ['stringr', 'tm', 'tidytext']],
      ['web_scraping', ['rvest', 'httr', 'jsonlite']],
      ['database', ['DBI', 'RSQLite', 'RPostgreSQL']],
      ['parallel', ['parallel', 'foreach', 'doParallel']]
    ]);
  }

  async generateRCode(
    request: CodeGenerationRequest,
    context: CodeContext,
    options?: RCodeGenerationOptions
  ): Promise<string> {
    const libraries = this.determineRequiredLibraries(request, options);
    const outputFormat = options?.outputFormat || 'json';
    const tidyverse = options?.tidyverse ?? true;
    
    const prompt = this.buildRPrompt(request, context, libraries, options);
    const generatedCode = await this.aiService.callAI(prompt);
    
    // Clean and format the code
    let cleanCode = this.cleanRCode(generatedCode);
    
    // Add library imports
    cleanCode = this.addLibraryImports(cleanCode, libraries, tidyverse);
    
    // Wrap for n8n compatibility
    return this.wrapForN8n(cleanCode, outputFormat);
  }

  private determineRequiredLibraries(
    request: CodeGenerationRequest,
    options?: RCodeGenerationOptions
  ): string[] {
    const libraries = new Set<string>();
    const description = request.description.toLowerCase();
    
    // Add explicitly requested libraries
    if (options?.libraries) {
      options.libraries.forEach(lib => libraries.add(lib));
    }
    
    // Add libraries based on task description
    if (description.includes('plot') || description.includes('graph') || options?.includeVisualization) {
      this.commonLibraries.get('visualization')?.forEach(lib => libraries.add(lib));
    }
    
    if (description.includes('statistical') || description.includes('regression') || options?.statisticalAnalysis) {
      this.commonLibraries.get('statistics')?.forEach(lib => libraries.add(lib));
    }
    
    if (description.includes('machine learning') || description.includes('predict')) {
      this.commonLibraries.get('machine_learning')?.forEach(lib => libraries.add(lib));
    }
    
    if (description.includes('time series') || description.includes('forecast')) {
      this.commonLibraries.get('time_series')?.forEach(lib => libraries.add(lib));
    }
    
    if (options?.parallel) {
      this.commonLibraries.get('parallel')?.forEach(lib => libraries.add(lib));
    }
    
    // Always include jsonlite for n8n compatibility
    libraries.add('jsonlite');
    
    return Array.from(libraries);
  }

  private buildRPrompt(
    request: CodeGenerationRequest,
    context: CodeContext,
    libraries: string[],
    options?: RCodeGenerationOptions
  ): string {
    return `
Generate R code for n8n workflow automation.

Task: ${request.description}

Requirements:
- Use tidyverse style: ${options?.tidyverse ?? true}
- Output format: ${options?.outputFormat || 'json'}
- Include visualization: ${options?.includeVisualization || false}
- Statistical analysis: ${options?.statisticalAnalysis || false}
- Available libraries: ${libraries.join(', ')}

Context:
${JSON.stringify(context.intent, null, 2)}

Generate R code that:
1. Reads input data from n8n (JSON format)
2. Performs the requested data processing/analysis
3. Handles errors gracefully
4. Returns results in ${options?.outputFormat || 'json'} format
5. Uses vectorized operations for efficiency
6. Includes comments explaining statistical methods
7. Follows R best practices and style guide
8. Is compatible with n8n's Code node R environment

The code should work within n8n's Code node with R support.`;
  }

  private cleanRCode(code: string): string {
    // Remove markdown code blocks
    code = code.replace(/```r\n?/gi, '');
    code = code.replace(/```R\n?/gi, '');
    code = code.replace(/```\n?/g, '');
    
    // Clean up extra whitespace
    code = code.trim();
    
    return code;
  }

  private addLibraryImports(code: string, libraries: string[], tidyverse: boolean): string {
    let imports = '# Load required libraries\n';
    
    // Suppress messages for cleaner output
    imports += 'suppressPackageStartupMessages({\n';
    
    if (tidyverse && !libraries.includes('tidyverse')) {
      imports += '  library(tidyverse)\n';
    }
    
    libraries.forEach(lib => {
      if (lib !== 'tidyverse' || !tidyverse) {
        imports += `  library(${lib})\n`;
      }
    });
    
    imports += '})\n\n';
    
    return imports + code;
  }

  private wrapForN8n(code: string, outputFormat: string): string {
    const template = `# R code for n8n Code node
# Ensure R is enabled in node settings

# Function to safely read JSON input from n8n
read_n8n_input <- function() {
  tryCatch({
    # Get input data from n8n
    input_json <- Sys.getenv("N8N_INPUT_DATA", "{}")
    if (input_json == "" || input_json == "{}") {
      # Fallback: try to read from stdin
      input_json <- paste(readLines(con = "stdin", warn = FALSE), collapse = "")
    }
    
    # Parse JSON input
    input_data <- fromJSON(input_json, flatten = TRUE)
    
    # If input is a single item, wrap in list
    if (!is.list(input_data) || !is.null(names(input_data))) {
      input_data <- list(input_data)
    }
    
    return(input_data)
  }, error = function(e) {
    cat(paste("Error reading input:", e$message, "\\n"), file = stderr())
    return(list())
  })
}

# Function to format output for n8n
format_n8n_output <- function(result, format = "${outputFormat}") {
  tryCatch({
    if (format == "json") {
      # Convert to n8n item format
      if (is.data.frame(result)) {
        items <- apply(result, 1, function(row) {
          list(json = as.list(row))
        })
      } else if (is.list(result)) {
        items <- lapply(result, function(item) {
          if (!is.null(names(item)) && "json" %in% names(item)) {
            return(item)
          } else {
            return(list(json = item))
          }
        })
      } else {
        items <- list(list(json = result))
      }
      
      return(toJSON(items, auto_unbox = TRUE, na = "null"))
      
    } else if (format == "dataframe") {
      return(toJSON(result, dataframe = "rows", auto_unbox = TRUE))
      
    } else if (format == "csv") {
      csv_string <- capture.output(write.csv(result, row.names = FALSE))
      return(toJSON(list(list(json = list(csv = paste(csv_string, collapse = "\\n"))))))
      
    } else {
      return(toJSON(list(list(json = result)), auto_unbox = TRUE))
    }
  }, error = function(e) {
    error_msg <- list(list(json = list(
      error = TRUE,
      message = paste("Output formatting error:", e$message)
    )))
    return(toJSON(error_msg, auto_unbox = TRUE))
  })
}

# Main processing function
process_data <- function(input_items) {
  # Initialize results
  results <- list()
  
  tryCatch({
    ${code}
    
    return(results)
  }, error = function(e) {
    cat(paste("Processing error:", e$message, "\\n"), file = stderr())
    return(list(error = e$message))
  })
}

# Execute main workflow
main <- function() {
  # Read input
  input_items <- read_n8n_input()
  
  # Process data
  results <- process_data(input_items)
  
  # Format and output results
  output <- format_n8n_output(results, "${outputFormat}")
  cat(output)
}

# Run main function
main()`;

    return template;
  }

  generateRFallbackCode(request: CodeGenerationRequest, options?: RCodeGenerationOptions): string {
    const description = request.description.toLowerCase();
    let code = '';
    
    if (description.includes('statistical') || description.includes('regression')) {
      code = this.generateStatisticalAnalysisCode();
    } else if (description.includes('plot') || description.includes('visualiz')) {
      code = this.generateVisualizationCode();
    } else if (description.includes('cluster') || description.includes('classification')) {
      code = this.generateMachineLearningCode();
    } else if (description.includes('transform') || description.includes('clean')) {
      code = this.generateDataTransformationCode();
    } else {
      code = this.generateGenericAnalysisCode();
    }
    
    const libraries = this.determineRequiredLibraries(request, options);
    code = this.addLibraryImports(code, libraries, options?.tidyverse ?? true);
    
    return this.wrapForN8n(code, options?.outputFormat || 'json');
  }

  private generateStatisticalAnalysisCode(): string {
    return `
    # Perform statistical analysis on each input item
    for (i in seq_along(input_items)) {
      item_data <- input_items[[i]]
      
      # Extract numeric columns for analysis
      numeric_data <- item_data[sapply(item_data, is.numeric)]
      
      if (length(numeric_data) > 0) {
        # Basic statistics
        summary_stats <- summary(numeric_data)
        
        # Correlation matrix if multiple numeric columns
        if (length(numeric_data) > 1) {
          correlation_matrix <- cor(numeric_data, use = "complete.obs")
        } else {
          correlation_matrix <- NULL
        }
        
        # Perform t-test if applicable
        if (length(numeric_data) >= 2) {
          first_col <- numeric_data[[1]]
          second_col <- numeric_data[[2]]
          t_test_result <- t.test(first_col, second_col)
          
          test_summary <- list(
            statistic = t_test_result$statistic,
            p_value = t_test_result$p.value,
            confidence_interval = t_test_result$conf.int
          )
        } else {
          test_summary <- NULL
        }
        
        # Store results
        results[[i]] <- list(
          original_data = item_data,
          summary_statistics = as.list(summary_stats),
          correlation_matrix = correlation_matrix,
          t_test = test_summary,
          n_observations = nrow(item_data)
        )
      } else {
        results[[i]] <- list(
          original_data = item_data,
          error = "No numeric data found for analysis"
        )
      }
    }`;
  }

  private generateVisualizationCode(): string {
    return `
    # Create visualizations for each input item
    plots <- list()
    
    for (i in seq_along(input_items)) {
      item_data <- as.data.frame(input_items[[i]])
      
      # Create a basic plot based on data structure
      if (ncol(item_data) >= 2) {
        # Scatter plot for two numeric columns
        numeric_cols <- names(item_data)[sapply(item_data, is.numeric)]
        
        if (length(numeric_cols) >= 2) {
          p <- ggplot(item_data, aes_string(x = numeric_cols[1], y = numeric_cols[2])) +
            geom_point() +
            geom_smooth(method = "lm", se = TRUE) +
            theme_minimal() +
            labs(title = paste("Scatter Plot - Item", i))
          
          # Save plot as base64 encoded image
          temp_file <- tempfile(fileext = ".png")
          ggsave(temp_file, p, width = 8, height = 6, dpi = 150)
          
          # Read and encode image
          img_base64 <- base64enc::base64encode(temp_file)
          unlink(temp_file)
          
          plots[[i]] <- img_base64
        }
      }
      
      # Add plot to results
      results[[i]] <- list(
        data_summary = summary(item_data),
        plot = if(length(plots) >= i) plots[[i]] else NULL,
        n_rows = nrow(item_data),
        n_cols = ncol(item_data)
      )
    }`;
  }

  private generateMachineLearningCode(): string {
    return `
    # Machine learning analysis
    for (i in seq_along(input_items)) {
      item_data <- as.data.frame(input_items[[i]])
      
      # Check if we have enough data
      if (nrow(item_data) < 10) {
        results[[i]] <- list(
          error = "Insufficient data for machine learning (need at least 10 rows)"
        )
        next
      }
      
      # Prepare data (assuming last column is target)
      if (ncol(item_data) > 1) {
        target_col <- names(item_data)[ncol(item_data)]
        feature_cols <- names(item_data)[-ncol(item_data)]
        
        # Split data
        set.seed(123)
        train_idx <- sample(1:nrow(item_data), 0.7 * nrow(item_data))
        train_data <- item_data[train_idx, ]
        test_data <- item_data[-train_idx, ]
        
        # Build model based on target type
        if (is.numeric(item_data[[target_col]])) {
          # Regression
          formula_str <- paste(target_col, "~", paste(feature_cols, collapse = " + "))
          model <- lm(as.formula(formula_str), data = train_data)
          
          # Predictions
          predictions <- predict(model, test_data)
          
          # Calculate RMSE
          rmse <- sqrt(mean((test_data[[target_col]] - predictions)^2))
          
          results[[i]] <- list(
            model_type = "linear_regression",
            coefficients = coef(model),
            r_squared = summary(model)$r.squared,
            rmse = rmse,
            n_train = nrow(train_data),
            n_test = nrow(test_data)
          )
        } else {
          # Classification
          results[[i]] <- list(
            model_type = "classification",
            message = "Classification not implemented in fallback"
          )
        }
      } else {
        results[[i]] <- list(
          error = "Need at least 2 columns for machine learning"
        )
      }
    }`;
  }

  private generateDataTransformationCode(): string {
    return `
    # Data transformation and cleaning
    for (i in seq_along(input_items)) {
      item_data <- input_items[[i]]
      
      # Convert to data frame for easier manipulation
      if (!is.data.frame(item_data)) {
        df <- as.data.frame(item_data)
      } else {
        df <- item_data
      }
      
      # Data cleaning operations
      # Remove duplicates
      df_clean <- df[!duplicated(df), ]
      
      # Handle missing values
      numeric_cols <- names(df_clean)[sapply(df_clean, is.numeric)]
      for (col in numeric_cols) {
        # Replace NA with median
        df_clean[[col]][is.na(df_clean[[col]])] <- median(df_clean[[col]], na.rm = TRUE)
      }
      
      # Standardize numeric columns
      df_standardized <- df_clean
      for (col in numeric_cols) {
        if (sd(df_clean[[col]], na.rm = TRUE) > 0) {
          df_standardized[[col]] <- scale(df_clean[[col]])[, 1]
        }
      }
      
      # Add transformation metadata
      results[[i]] <- list(
        original_rows = nrow(df),
        cleaned_rows = nrow(df_clean),
        duplicates_removed = nrow(df) - nrow(df_clean),
        columns_standardized = numeric_cols,
        transformed_data = df_standardized
      )
    }`;
  }

  private generateGenericAnalysisCode(): string {
    return `
    # Generic data analysis
    for (i in seq_along(input_items)) {
      item_data <- input_items[[i]]
      
      # Convert to data frame if needed
      if (!is.data.frame(item_data)) {
        df <- as.data.frame(item_data)
      } else {
        df <- item_data
      }
      
      # Perform basic analysis
      analysis_results <- list(
        n_rows = nrow(df),
        n_cols = ncol(df),
        column_names = names(df),
        column_types = sapply(df, class),
        missing_values = sapply(df, function(x) sum(is.na(x))),
        unique_values = sapply(df, function(x) length(unique(x)))
      )
      
      # Add numeric summaries
      numeric_cols <- names(df)[sapply(df, is.numeric)]
      if (length(numeric_cols) > 0) {
        analysis_results$numeric_summary <- summary(df[numeric_cols])
      }
      
      # Store results
      results[[i]] <- analysis_results
    }`;
  }

  async validateRCode(code: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const validationPrompt = `
Validate this R code for n8n Code node:

${code}

Check for:
1. Syntax errors
2. Missing library dependencies
3. Performance issues
4. Statistical methodology concerns
5. n8n compatibility issues

Return validation result:
{
  "isValid": true/false,
  "errors": ["list of errors"],
  "warnings": ["list of warnings"]
}`;

    try {
      const result = await this.aiService.getJSONResponse(validationPrompt);
      return result;
    } catch (error) {
      return {
        isValid: true,
        errors: [],
        warnings: ['Automated validation unavailable']
      };
    }
  }
}