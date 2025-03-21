package main

import (
	"bufio"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/spf13/cobra"
)

// Global variables
var (
	templateFile  string
	dir           string
	filePatterns  []string
	patternSymbol string
	logLevel      string
)

// Sets up the logger
func setupLogger() {
	var level slog.Level
	switch logLevel {
	case "debug":
		level = slog.LevelDebug
	case "info":
		level = slog.LevelInfo
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	logger := slog.New(handler)
	slog.SetDefault(logger)
}

// Reads variables from template file
func loadTemplateVars() map[string]string {
	vars := make(map[string]string)

	file, err := os.Open(templateFile)
	if err != nil {
		slog.Error("Cannot open template file", "file", templateFile, "error", err)
		os.Exit(1)
	}
	defer file.Close()

	slog.Debug("Reading template file", "file", templateFile)

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
			slog.Info("Variable (environment)", "key", key, "value", value)
		} else {
			slog.Info("Variable (default)", "key", key, "value", value)
		}

		vars[key] = value
	}

	if err := scanner.Err(); err != nil {
		slog.Error("Error reading template file", "error", err)
		os.Exit(1)
	}

	return vars
}

// Processes a single file
func processFile(filePath string, vars map[string]string) {
	slog.Debug("Processing file", "file", filePath)

	data, err := os.ReadFile(filePath)
	if err != nil {
		slog.Warn("Skipping file due to read error", "file", filePath, "error", err)
		return
	}

	content := string(data)
	modified := false

	for key, value := range vars {
		placeholder := regexp.MustCompile(regexp.QuoteMeta(patternSymbol) + key + regexp.QuoteMeta(patternSymbol))
		if placeholder.MatchString(content) {
			slog.Debug("Replacing variable in file", "file", filePath, "key", key, "value", value)
			content = placeholder.ReplaceAllString(content, value)
			modified = true
		}
	}

	if modified {
		slog.Info("Updated file", "file", filePath)
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			slog.Error("Error writing file", "file", filePath, "error", err)
		}
	}
}

// Recursively processes all files in the directory
func processDirectory(root string, vars map[string]string) {
	slog.Info("Replace variables in directory", "dir", root)

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			slog.Warn("Skipping file due to error", "file", path, "error", err)
			return nil
		}

		if d.IsDir() {
			slog.Debug("Entering directory", "dir", path)
			return nil
		}

		for _, pattern := range filePatterns {
			if matched, _ := filepath.Match(pattern, filepath.Base(path)); matched {
				slog.Debug("File matches pattern", "file", path, "pattern", pattern)
				processFile(path, vars)
				break
			}
		}

		return nil
	})

	if err != nil {
		slog.Error("Error processing directory", "error", err)
	}
}

// Executes a command after processing files
func runCommand(cmdArgs []string) {
	if len(cmdArgs) > 0 {
		slog.Info("Executing command", "command", strings.Join(cmdArgs, " "))
		cmd := exec.Command(cmdArgs[0], cmdArgs[1:]...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			slog.Error("Error executing command", "error", err)
			os.Exit(1)
		}
	}
}

// Cobra CLI command
var rootCmd = &cobra.Command{
	Use:   "replace_vars",
	Short: "Replace variables in files recursively",
	Run: func(cmd *cobra.Command, args []string) {
		setupLogger()
		vars := loadTemplateVars()
		processDirectory(dir, vars)
		runCommand(args)
	},
}

func main() {
	rootCmd.Flags().StringVarP(&templateFile, "template", "t", "/dot_env_defaults", "Template file")
	rootCmd.Flags().StringVarP(&dir, "dir", "d", "/usr/share/nginx/html", "Directory")
	rootCmd.Flags().StringSliceVarP(&filePatterns, "patterns", "p", []string{"*.js", "*.css", "*.html"}, "File patterns")
	rootCmd.Flags().StringVarP(&patternSymbol, "symbol", "s", "@@", "Placeholder pattern")
	rootCmd.Flags().StringVarP(&logLevel, "log-level", "l", "info", "Log level (debug, info, warn, error)")

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
