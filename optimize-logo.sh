#!/bin/bash
# Script to optimize vlm-logo.png for web use
# This script requires ImageMagick (convert) or similar tools

LOGO_SRC="assets/vlm-logo.png"
LOGO_DIR="assets"

echo "Optimizing logo image..."

# Check if ImageMagick is available
if command -v convert &> /dev/null; then
    echo "Using ImageMagick..."
    
    # Create optimized PNG at display size (160x60)
    convert "$LOGO_SRC" -resize 160x60 -quality 85 "$LOGO_DIR/vlm-logo-160.png"
    
    # Create WebP version at 1x
    convert "$LOGO_SRC" -resize 160x60 -quality 85 -define webp:lossless=false "$LOGO_DIR/vlm-logo.webp"
    
    # Create WebP version at 2x (320x120)
    convert "$LOGO_SRC" -resize 320x120 -quality 85 -define webp:lossless=false "$LOGO_DIR/vlm-logo@2x.webp"
    
    echo "Optimized images created:"
    echo "  - $LOGO_DIR/vlm-logo-160.png (optimized PNG)"
    echo "  - $LOGO_DIR/vlm-logo.webp (WebP 1x)"
    echo "  - $LOGO_DIR/vlm-logo@2x.webp (WebP 2x)"
    
elif command -v cwebp &> /dev/null; then
    echo "Using cwebp..."
    # First resize with ImageMagick or another tool, then convert to WebP
    echo "Note: cwebp requires pre-resized images. Please install ImageMagick for full optimization."
    
else
    echo "ImageMagick or cwebp not found."
    echo ""
    echo "To optimize the logo manually:"
    echo "1. Install ImageMagick: sudo apt-get install imagemagick (Linux) or brew install imagemagick (Mac)"
    echo "2. Or use an online tool like:"
    echo "   - https://squoosh.app/"
    echo "   - https://cloudconvert.com/png-to-webp"
    echo ""
    echo "Target sizes:"
    echo "  - PNG: 160x60px, optimized"
    echo "  - WebP 1x: 160x60px"
    echo "  - WebP 2x: 320x120px (for retina displays)"
    echo ""
    echo "After optimization, update iva/index.html to use:"
    echo '  <img src="../assets/vlm-logo.webp" srcset="../assets/vlm-logo.webp 1x, ../assets/vlm-logo@2x.webp 2x" ...>'
fi

