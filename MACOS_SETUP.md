# Hướng dẫn Build và Chạy trên macOS

## Yêu cầu

1. **Icon file cho macOS**: Bạn cần tạo file `assets/icon.icns` cho macOS. File `.ico` chỉ dùng cho Windows.

   Cách tạo file `.icns`:
   - Sử dụng công cụ `iconutil` trên macOS:
     ```bash
     # Tạo thư mục iconset
     mkdir icon.iconset
     
     # Copy các file PNG với kích thước khác nhau vào iconset
     # (16x16, 32x32, 128x128, 256x256, 512x512, 1024x1024)
     
     # Convert sang .icns
     iconutil -c icns icon.iconset -o assets/icon.icns
     ```
   
   Hoặc sử dụng công cụ online như:
   - https://cloudconvert.com/png-to-icns
   - https://iconverticons.com/online/

2. **Quyền truy cập**: Trên macOS, ứng dụng cần quyền truy cập:
   - Screen Recording (để chụp màn hình)
   - Accessibility (để phát hiện URL từ browser)

## Build cho macOS

### Build DMG file:
```bash
npm run build-mac
```

### Build cả Windows và macOS:
```bash
npm run build-all
```

## Các thay đổi đã thực hiện

1. ✅ **Icon paths**: Tự động chọn `.icns` trên macOS và `.ico` trên Windows
2. ✅ **URL Detection**: Hỗ trợ AppleScript trên macOS để lấy URL từ browser
3. ✅ **System Tray**: Hành vi click khác nhau giữa Windows và macOS
4. ✅ **Build scripts**: Thêm scripts để build cho macOS
5. ✅ **Shortcuts**: Đã sử dụng `CommandOrControl` (tự động dùng Cmd trên macOS)

## Lưu ý

- Trên macOS, single click vào tray icon sẽ mở cửa sổ (khác với Windows)
- URL detection trên macOS hỗ trợ Chrome, Safari, Firefox, và Edge
- Cần cấp quyền Screen Recording và Accessibility khi chạy lần đầu

## Testing trên macOS

1. Cài đặt dependencies:
   ```bash
   npm install
   ```

2. Chạy ở chế độ development:
   ```bash
   npm run dev
   ```

3. Build và test:
   ```bash
   npm run build-mac
   ```
