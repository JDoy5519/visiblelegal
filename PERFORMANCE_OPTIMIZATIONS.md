# Performance Optimizations for IVA Page

## Summary
This document outlines the performance optimizations applied to the IVA page (`iva/index.html`) based on speed test results.

## Optimizations Implemented

### 1. Render-Blocking CSS Optimization ✅
**Issue**: CSS files were blocking initial render (680ms + 850ms + 170ms)

**Solution**:
- Added inline critical CSS for above-the-fold content (header, hero section)
- Deferred non-critical CSS files using `preload` with `onload` handler
- Global stylesheet (`style.20251024.css`) loads asynchronously
- IVA-specific styles (`styles.css`) load asynchronously
- Added polyfill for older browsers

**Impact**: Non-critical CSS no longer blocks initial render, improving FCP and LCP.

### 2. JavaScript Optimization ✅
**Issue**: `env.js` was blocking render (510ms)

**Solution**:
- Inlined `env.js` content directly in HTML (it's only ~10 lines)
- Removed render-blocking script tag

**Impact**: Eliminated 510ms of render-blocking JavaScript.

### 3. Font Loading Optimization ✅
**Issue**: Font loading was part of critical path (978ms total)

**Solution**:
- Added `preload` hints for both font files (Open Sans, Poppins)
- Fonts load with `font-display: swap` (already configured)
- Fonts.css loads synchronously (small file, needed early)

**Impact**: Fonts start loading earlier, reducing perceived load time.

### 4. Image Optimization ✅
**Issue**: `vlm-logo.png` was 1.5MB but displayed at only 160x60px

**Solution**:
- Created optimized versions:
  - `vlm-logo-160.png`: 6KB (1x, 160x60px)
  - `vlm-logo-320.png`: 17KB (2x, 320x120px for retina)
- Updated HTML to use optimized version with `srcset` for responsive images
- Maintained `fetchpriority="high"` and `loading="eager"` for above-the-fold image

**Impact**: Reduced image size from 1.5MB to 6KB (99.6% reduction), saving ~1.48MB per page load.

### 5. Layout Shift Prevention ✅
**Issue**: CLS score of 0.124, hero section causing shifts

**Solution**:
- Added inline critical CSS with explicit dimensions
- Set `min-height: 400px` on hero section to reserve space
- Added explicit `width` and `height` attributes to logo image
- Font fallbacks configured to prevent text shift

**Impact**: Reduced Cumulative Layout Shift (CLS) by reserving space for content.

## File Changes

### Modified Files:
1. `iva/index.html` - Added inline critical CSS, optimized resource loading, inlined env.js, updated logo reference
2. `assets/css/fonts.css` - No changes (already optimized with font-display: swap)

### New Files:
1. `assets/vlm-logo-160.png` - Optimized 1x logo (6KB)
2. `assets/vlm-logo-320.png` - Optimized 2x logo (17KB)
3. `optimize-logo.sh` - Script for future logo optimizations

## Expected Performance Improvements

Based on the optimizations:

1. **Render Blocking**: ~680ms saved (CSS deferral)
2. **JavaScript Blocking**: ~510ms saved (env.js inlined)
3. **Image Size**: ~1.48MB saved (logo optimization)
4. **Layout Shift**: CLS should improve significantly
5. **Font Loading**: Earlier font loading with preload hints

## Testing Recommendations

1. Run Lighthouse/PageSpeed Insights again to verify improvements
2. Test on slow 3G connection to see real-world impact
3. Verify all functionality still works (forms, modals, etc.)
4. Check that fonts load correctly
5. Verify logo displays correctly on all devices

## Notes

- The original `vlm-logo.png` (1.5MB) is kept for reference but should not be used in production
- Consider converting optimized PNGs to WebP format for additional savings (~30-50% smaller)
- Monitor Core Web Vitals after deployment to ensure improvements are sustained

## Future Optimizations (Optional)

1. Convert logo to WebP format for additional 30-50% size reduction
2. Consider using a CDN for static assets
3. Implement service worker for caching
4. Further split CSS if needed (extract form-specific styles)
5. Consider lazy-loading below-the-fold images

