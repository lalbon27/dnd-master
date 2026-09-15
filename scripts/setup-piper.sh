#!/usr/bin/env bash
# Скачивает бинарник Piper TTS и русский голос (denis), если их ещё нет.
# Запускается автоматически через `npm install` (postinstall) — и локально, и на Render.
# Если что-то пойдёт не так, скрипт просто завершится без ошибки: озвучка на сервере
# останется недоступна, но приложение продолжит работать (откат на голос браузера).
set -uo pipefail

VERSION="2023.11.14-2"
BIN_DIR="bin/piper"
VOICE_DIR="bin/voices"

# Голос можно переопределить через PIPER_VOICE в .env (denis | dmitri | ruslan | irina).
SPEAKER="denis"
if [ -f .env ]; then
  ENV_VOICE="$(grep -E '^PIPER_VOICE=' .env | tail -n1 | cut -d= -f2- | tr -d '[:space:]')"
  if [ -n "$ENV_VOICE" ]; then
    SPEAKER="${ENV_VOICE#ru_RU-}"
    SPEAKER="${SPEAKER%-medium}"
  fi
fi
VOICE="ru_RU-${SPEAKER}-medium"

mkdir -p "$BIN_DIR" "$VOICE_DIR"

if [ ! -f "$BIN_DIR/piper" ] && [ ! -f "$BIN_DIR/piper.exe" ]; then
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "$OS" in
    Linux*) ASSET="piper_linux_x86_64.tar.gz" ;;
    Darwin*)
      if [ "$ARCH" = "arm64" ]; then ASSET="piper_macos_aarch64.tar.gz"; else ASSET="piper_macos_x64.tar.gz"; fi
      ;;
    MINGW*|MSYS*|CYGWIN*) ASSET="piper_windows_amd64.zip" ;;
    *) echo "setup-piper: неизвестная ОС '$OS', пропускаю установку Piper"; exit 0 ;;
  esac

  echo "setup-piper: скачиваю $ASSET..."
  if ! curl -sL "https://github.com/rhasspy/piper/releases/download/$VERSION/$ASSET" -o "bin/$ASSET"; then
    echo "setup-piper: не удалось скачать Piper, пропускаю"; exit 0
  fi

  case "$ASSET" in
    *.tar.gz) tar -xzf "bin/$ASSET" -C bin ;;
    *.zip) unzip -o -q "bin/$ASSET" -d bin ;;
  esac
  rm -f "bin/$ASSET"
  echo "setup-piper: бинарник готов в $BIN_DIR"
else
  echo "setup-piper: бинарник уже есть, пропускаю загрузку"
fi

MODEL_FILE="$VOICE_DIR/$VOICE.onnx"
if [ ! -f "$MODEL_FILE" ]; then
  echo "setup-piper: скачиваю голос $VOICE..."
  curl -sL "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/$SPEAKER/medium/$VOICE.onnx" \
    -o "$MODEL_FILE" || echo "setup-piper: не удалось скачать модель голоса, пропускаю"
  curl -sL "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/$SPEAKER/medium/$VOICE.onnx.json" \
    -o "$VOICE_DIR/$VOICE.onnx.json" || true
else
  echo "setup-piper: голос уже есть, пропускаю загрузку"
fi

echo "setup-piper: готово"
