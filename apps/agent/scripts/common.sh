#!/bin/bash

# common.sh - Common utility functions for scripts

WORKSPACE_DIR="/workspace"

# Function to print errors to stderr
print_error() {
    echo "[ERROR] $1" >&2
}

# Function to print info messages
print_info() {
    echo "[INFO] $1"
}

# Function to print success messages
print_success() {
    echo "[SUCCESS] $1"
}

# Function to print warning messages
print_warning() {
    echo "[WARNING] $1"
}
