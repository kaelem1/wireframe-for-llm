APP_NAME := FuckDesign
SWIFT := $(shell if [ -x /opt/homebrew/opt/swift/bin/swift ]; then echo /opt/homebrew/opt/swift/bin/swift; else echo xcrun swift; fi)
BUILD_DIR := .build/release
APP_DIR := Build/$(APP_NAME).app
MACOS_DIR := $(APP_DIR)/Contents/MacOS
RESOURCES_DIR := $(APP_DIR)/Contents/Resources

.PHONY: build run test install clean

build:
	$(SWIFT) build

run:
	$(SWIFT) run $(APP_NAME)

test:
	$(SWIFT) test

install:
	$(SWIFT) build -c release
	mkdir -p $(MACOS_DIR) $(RESOURCES_DIR)
	cp $(BUILD_DIR)/$(APP_NAME) $(MACOS_DIR)/$(APP_NAME)
	cp Resources/Info.plist $(APP_DIR)/Contents/Info.plist
	codesign --force --deep --sign - $(APP_DIR)

clean:
	rm -rf .build Build
