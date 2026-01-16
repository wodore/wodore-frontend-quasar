#!/bin/bash

# Get configuration from package.json
IMAGE_NAME=$(cat package.json | grep name | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')
REGISTRY=$(cat package.json | grep registry | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')
DEFAULT_TAG_SUFFIX=$(cat package.json | grep tagSuffix | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')

# Parse command line options
VERSION_TAGS=false
TAG_SUFFIX=""
while getopts "hvs:" opt; do
  case $opt in
    h)
      echo "Usage: $0 [-h] [-v] [-s <suffix>]"
      echo ""
      echo "Options:"
      echo "  -h: Show this help message"
      echo "  -v: Include version tags"
      echo "  -s: Tag suffix (default: ${DEFAULT_TAG_SUFFIX}), include '-' as well."
      exit 0
      ;;
    v)
      VERSION_TAGS=true
      ;;
    s)
      TAG_SUFFIX="$OPTARG"
      ;;
    \?)
      echo "Usage: $0 [-h] [-v] [-s <suffix>]"
      echo ""
      echo "Options:"
      echo "  -h: Show this help message"
      echo "  -v: Include version tags"
      echo "  -s: Tag suffix (default: ${DEFAULT_TAG_SUFFIX}), include '-' as well."
      exit 1
      ;;
  esac
done

# Use default tag suffix if none provided
if [ -z "$TAG_SUFFIX" ]; then
  TAG_SUFFIX="$DEFAULT_TAG_SUFFIX"
fi

# Get the full git hash
GIT_HASH=$(git rev-parse HEAD)

# Get repository URL from git
REPO_URL=$(git config --get remote.origin.url)
# Extract repository name from URL (works with both SSH and HTTPS URLs)
REPO_NAME=$(echo $REPO_URL | sed 's|.*/\(.*\)\.git|\1|' | sed 's|.*/\(.*\)|\1|')
REGISTRY_URL="${REGISTRY}/${REPO_NAME}"

# Get the version from package.json if version tags are requested
if [ "$VERSION_TAGS" = true ]; then
  VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')
  MAJOR=$(echo $VERSION | cut -d. -f1)
  MINOR=$(echo $VERSION | cut -d. -f2)
  PATCH=$(echo $VERSION | cut -d. -f3)
fi

# Check git status
./scripts/check-git-status.sh
if [ $? -ne 0 ]; then
  echo "Error: Git repository is dirty. Please commit or stash your changes before publishing."
  exit 1
fi

# Set GIT_HASH environment variable before Docker build
export GIT_HASH=$GIT_HASH

# Build the Docker image
echo "Building Docker image..."
yarn docker:build
if [ $? -ne 0 ]; then
  echo "Error: Docker build failed. Aborting publish."
  exit 1
fi

# Tag the image with edge and git hash
docker image tag $IMAGE_NAME ${REGISTRY_URL}:edge${TAG_SUFFIX}
docker image tag $IMAGE_NAME ${REGISTRY_URL}:sha-${GIT_HASH}${TAG_SUFFIX}

# Tag with version tags if requested
if [ "$VERSION_TAGS" = true ]; then
  docker image tag $IMAGE_NAME ${REGISTRY_URL}:${MAJOR}${TAG_SUFFIX}
  docker image tag $IMAGE_NAME ${REGISTRY_URL}:${MAJOR}.${MINOR}${TAG_SUFFIX}
  docker image tag $IMAGE_NAME ${REGISTRY_URL}:${VERSION}${TAG_SUFFIX}
fi

# Push all tags to the registry
docker push ${REGISTRY_URL}:edge${TAG_SUFFIX}
docker push ${REGISTRY_URL}:${GIT_HASH}${TAG_SUFFIX}

# Push version tags if requested
if [ "$VERSION_TAGS" = true ]; then
  docker push ${REGISTRY_URL}:${MAJOR}${TAG_SUFFIX}
  docker push ${REGISTRY_URL}:${MAJOR}.${MINOR}${TAG_SUFFIX}
  docker push ${REGISTRY_URL}:${VERSION}${TAG_SUFFIX}
fi

# Print all tags that were pushed
echo "Pushed tags:"
echo "- edge${TAG_SUFFIX}"
echo "- ${GIT_HASH}${TAG_SUFFIX}"

# Print version tags if requested
if [ "$VERSION_TAGS" = true ]; then
  echo "- ${MAJOR}${TAG_SUFFIX}"
  echo "- ${MAJOR}.${MINOR}${TAG_SUFFIX}"
  echo "- ${VERSION}${TAG_SUFFIX}"
fi
