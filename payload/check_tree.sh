#!/bin/bash
echo "Full process list (filtered):"
ps -ef | grep -E "payload|npm|node" | grep -v grep
