package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
)

// LogLevel represents the logging verbosity levels
const (
	LogLevelDebug = "debug"
	LogLevelInfo  = "info"
	LogLevelWarn  = "warn"
	LogLevelError = "error"
)

// logLevel controls the verbosity of the output
var logLevel = LogLevelInfo

// log prints messages with the specified level
func log(level, format string, args ...interface{}) {
	if shouldLog(level) {
		fmt.Printf("[%s] %s\n", strings.ToUpper(level), fmt.Sprintf(format, args...))
	}
}

// shouldLog determines if messages of the given level should be logged
func shouldLog(level string) bool {
	levels := []string{LogLevelDebug, LogLevelInfo, LogLevelWarn, LogLevelError}
	currentLevelIndex := -1
	messageLevelIndex := -1

	for i, l := range levels {
		if l == logLevel {
			currentLevelIndex = i
		}
		if l == level {
			messageLevelIndex = i
		}
	}

	return messageLevelIndex >= currentLevelIndex
}

// Variable represents a variable to be replaced
type Variable struct {
	Key      string
	Value    string
	Pattern  *regexp.Regexp
}

// printUsage prints the usage text and examples
func printUsage() {
	// Print the flag-generated usage
	flag.Usage()
	fmt.Println()

	// Add our examples section
	examples := `Examples:
  # Basic usage
  replace_vars

  # Custom template and directory
  replace_vars --template=/path/to/template --directory=/path/to/html

  # Process specific files
  replace_vars --patterns=*.js,*.html --symbol=%%

  # Debug mode
  replace_vars --log-level=debug`

	fmt.Println(examples)
	os.Exit(1)
}

func main() {
	// Define flags
	templateFile := flag.String("template", "/dot_env_defaults", "Template file")
	dir := flag.String("directory", "/usr/share/nginx/html", "Directory to process")
	filePatterns := flag.String("patterns", "*.js,*.css,*.html", "File patterns to process")
	patternSymbol := flag.String("symbol", "@@", "Placeholder symbol")
	logLevelFlag := flag.String("log-level", "info", "Log level (debug, info, warn, error)")

	// Parse flags
	flag.Parse()

	// Update logLevel variable
	logLevel = *logLevelFlag

	// Show usage if no arguments are provided
	if len(os.Args) == 1 {
		printUsage()
	}

	// Load template variables
	log(LogLevelDebug, "Loading template variables from: %s", *templateFile)
	vars := make([]Variable, 0)
	file, err := os.Open(*templateFile)
	if err != nil {
		log(LogLevelError, "Cannot open template file: %v", err)
		os.Exit(1)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		value := ""
		if len(parts) == 2 {
			value = strings.TrimSpace(parts[1])
		}

		if envValue, exists := os.LookupEnv(key); exists {
			value = envValue
			log(LogLevelInfo, "Variable (environment): %s=%s", key, value)
		} else {
			log(LogLevelInfo, "Variable (default): %s=%s", key, value)
		}

		// Compile regex pattern once and store it
		pattern := regexp.MustCompile(regexp.QuoteMeta(*patternSymbol) + key + regexp.QuoteMeta(*patternSymbol))
		vars = append(vars, Variable{Key: key, Value: value, Pattern: pattern})
	}

	if err := scanner.Err(); err != nil {
		log(LogLevelError, "Cannot read template file: %v", err)
		os.Exit(1)
	}

	// Process directory
	log(LogLevelInfo, "Replace variables in directory: %s", *dir)
	processDirectory(*dir, vars, *filePatterns)

	// Run command if provided
	cmdArgs := flag.Args()
	if len(cmdArgs) > 0 {
		log(LogLevelInfo, "Executing command: %s", strings.Join(cmdArgs, " "))
		cmd := exec.Command(cmdArgs[0], cmdArgs[1:]...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			log(LogLevelError, "Cannot execute command: %v", err)
			os.Exit(1)
		}
	}
}

// processDirectory processes files in the directory concurrently
func processDirectory(root string, vars []Variable, patterns string) {
	// Create a channel for file paths
	fileChan := make(chan string, 100)
	// Create a wait group to track goroutines
	var wg sync.WaitGroup
	// Create an atomic counter for processed files
	var processedFiles int32

	// Start worker goroutines
	for i := 0; i < runtime.NumCPU(); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for filePath := range fileChan {
				if processFile(filePath, vars) {
					atomic.AddInt32(&processedFiles, 1)
				}
			}
		}()
	}

	// Walk directory and send files to channel
	go func() {
		filePatterns := strings.Split(patterns, ",")
		filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				log(LogLevelWarn, "Skipping file due to error: %v", err)
				return nil
			}

			if d.IsDir() {
				log(LogLevelDebug, "Entering directory: %s", path)
				return nil
			}

			for _, pattern := range filePatterns {
				if matched, _ := filepath.Match(pattern, filepath.Base(path)); matched {
					log(LogLevelDebug, "File matches pattern: %s (%s)", path, pattern)
					fileChan <- path
					break
				}
			}

			return nil
		})
		close(fileChan)
	}()

	// Wait for all workers to finish
	wg.Wait()

	log(LogLevelInfo, "Processed %d files", processedFiles)
}

// processFile processes a single file with optimized I/O
func processFile(filePath string, vars []Variable) bool {
	log(LogLevelDebug, "Processing file: %s", filePath)

	// Get original file permissions
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		log(LogLevelWarn, "Skipping file due to stat error: %v", err)
		return false
	}
	originalMode := fileInfo.Mode()

	// Read file with buffered I/O
	file, err := os.Open(filePath)
	if err != nil {
		log(LogLevelWarn, "Skipping file due to read error: %v", err)
		return false
	}
	defer file.Close()

	// Create a temporary file for writing
	tempFile, err := os.CreateTemp("", "replace_vars_temp_"+filepath.Base(filePath))
	if err != nil {
		log(LogLevelError, "Cannot create temporary file: %v", err)
		return false
	}
	defer os.Remove(tempFile.Name())

	// Set temporary file permissions to match original
	if err := os.Chmod(tempFile.Name(), originalMode); err != nil {
		log(LogLevelError, "Cannot set temporary file permissions: %v", err)
		return false
	}

	// Use buffered writer for the temporary file
	writer := bufio.NewWriter(tempFile)
	buffer := make([]byte, 1024*1024*5) // 5MB buffer
	modified := false

	for {
		// Read a chunk of the file
		n, err := file.Read(buffer)
		if err != nil && err != io.EOF {
			log(LogLevelWarn, "Error reading file: %v", err)
			return false
		}
		if n == 0 {
			break
		}

		// Process variables in reverse order to avoid overlapping replacements
		chunk := string(buffer[:n])
		for i := len(vars) - 1; i >= 0; i-- {
			v := vars[i]
			if v.Pattern.MatchString(chunk) {
				log(LogLevelDebug, "Replacing variable in file: %s (%s=%s)", filePath, v.Key, v.Value)
				chunk = v.Pattern.ReplaceAllString(chunk, v.Value)
				modified = true
			}
		}

		// Write the processed chunk
		if _, err := writer.WriteString(chunk); err != nil {
			log(LogLevelError, "Cannot write to temporary file: %v", err)
			return false
		}
	}

	// Flush the writer
	if err := writer.Flush(); err != nil {
		log(LogLevelError, "Cannot flush temporary file: %v", err)
		return false
	}

	if modified {
		log(LogLevelInfo, "Updated file: %s", filePath)

		// Replace the original file with the temporary file
		if err := os.Rename(tempFile.Name(), filePath); err != nil {
			log(LogLevelError, "Cannot replace original file: %v", err)
			return false
		}

		// Ensure the replaced file has the correct ownership
		if err := os.Chown(filePath, int(fileInfo.Sys().(*syscall.Stat_t).Uid), int(fileInfo.Sys().(*syscall.Stat_t).Gid)); err != nil {
			log(LogLevelError, "Cannot set file ownership: %v", err)
			return false
		}
	}

	return modified
}
