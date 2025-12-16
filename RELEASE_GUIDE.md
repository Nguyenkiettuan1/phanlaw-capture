# 🚀 Hướng Dẫn Release Phiên Bản Mới

## 📋 Tổng Quan

Hướng dẫn chi tiết cách release phiên bản mới cho ứng dụng Electron với auto-update.

---

## ✅ Chuẩn Bị Trước Khi Release

### 1. **Kiểm Tra GitHub CLI**

Script release sử dụng GitHub CLI (`gh`) để tạo release tự động. Đảm bảo đã cài đặt:

```bash
# Kiểm tra xem đã cài chưa
gh --version

# Nếu chưa có, cài đặt:
# Windows: winget install GitHub.cli
# Hoặc tải từ: https://cli.github.com/
```

### 2. **Đăng Nhập GitHub CLI**

```bash
gh auth login
```

Chọn:
- GitHub.com
- HTTPS
- Login với web browser hoặc token

### 3. **Kiểm Tra Git**

```bash
# Đảm bảo đã commit tất cả thay đổi
git status

# Nếu có thay đổi chưa commit:
git add .
git commit -m "Your commit message"
```

### 4. **Kiểm Tra Repo Name**

Đảm bảo repo name trong `package.json` đúng:
```json
"publish": {
  "provider": "github",
  "owner": "Nguyenkiettuan1",
  "repo": "phanlaw-capture"  // ← Phải đúng tên repo
}
```

---

## 🎯 Cách Release (Tự Động - Khuyến Nghị)

### Bước 1: Chọn Loại Version

Có 3 loại version:

#### **PATCH** (1.0.12 → 1.0.13)
- Bug fixes nhỏ
- Sửa lỗi
- Cải thiện hiệu suất

```bash
npm run release:patch
```

#### **MINOR** (1.0.12 → 1.1.0)
- Tính năng mới
- Cải thiện lớn
- Không breaking changes

```bash
npm run release:minor
```

#### **MAJOR** (1.0.12 → 2.0.0)
- Breaking changes
- Thay đổi lớn về API
- Refactor lớn

```bash
npm run release:major
```

---

### Bước 2: Chạy Script Release

```bash
# Ví dụ: Release patch version
npm run release:patch
```

**Script sẽ tự động:**

1. ✅ **Tăng version** trong `package.json`
   ```
   1.0.12 → 1.0.13
   ```

2. ✅ **Git commit và tag**
   ```bash
   git commit -m "Release v1.0.13"
   git tag v1.0.13
   ```

3. ✅ **Push lên GitHub**
   ```bash
   git push origin main
   git push origin --tags
   ```

4. ✅ **Build app**
   ```bash
   npm run build-win
   ```
   Tạo file:
   - `Test Automation Screen Auto-Setup-1.0.13.exe`
   - `Test Automation Screen Auto-Setup-1.0.13.exe.blockmap`
   - `latest.yml`

5. ✅ **Tạo GitHub Release**
   - Upload tất cả file cần thiết
   - Tạo release notes

---

### Bước 3: Nhập Release Notes

Script sẽ hỏi bạn nhập release notes:

```
📝 Step 6: Release Notes
Enter release notes (or press Enter for default):
```

**Ví dụ release notes tốt:**
```
Version 1.0.13

✨ Tính năng mới:
- Thêm tính năng auto-update
- Cải thiện UI

🐛 Sửa lỗi:
- Sửa lỗi crash khi upload screenshot
- Sửa lỗi memory leak

⚡ Cải thiện:
- Tối ưu hiệu suất
- Giảm thời gian khởi động
```

**Hoặc nhấn Enter** để dùng mặc định:
```
Release v1.0.13

Bug fixes and improvements.
```

---

### Bước 4: Hoàn Tất

Sau khi script chạy xong:

```
🎉 Release completed successfully!

📦 Users can now download v1.0.13
🔄 Existing users will be notified to update automatically
🔗 https://github.com/Nguyenkiettuan1/phanlaw-capture/releases/tag/v1.0.13
```

**Người dùng sẽ:**
- Tự động nhận thông báo cập nhật khi mở app
- Có thể tải về từ GitHub Releases

---

## 🔧 Release Thủ Công (Nếu Script Tự Động Lỗi)

Nếu script tự động gặp lỗi, bạn có thể release thủ công:

### Bước 1: Tăng Version

Sửa `package.json`:
```json
{
  "version": "1.0.13"  // ← Tăng version
}
```

### Bước 2: Commit và Tag

```bash
git add package.json
git commit -m "Release v1.0.13"
git tag v1.0.13
git push origin main
git push origin --tags
```

### Bước 3: Build App

```bash
npm run build-win
```

Kiểm tra file trong `dist/`:
- ✅ `Test Automation Screen Auto-Setup-1.0.13.exe`
- ✅ `Test Automation Screen Auto-Setup-1.0.13.exe.blockmap`
- ✅ `latest.yml`

### Bước 4: Tạo GitHub Release

#### Cách 1: Dùng GitHub CLI

```bash
gh release create v1.0.13 \
  "dist/Test Automation Screen Auto-Setup-1.0.13.exe" \
  "dist/Test Automation Screen Auto-Setup-1.0.13.exe.blockmap" \
  "dist/latest.yml" \
  --title "Version 1.0.13" \
  --notes "Release v1.0.13

✨ Tính năng mới:
- Thêm tính năng auto-update

🐛 Sửa lỗi:
- Sửa lỗi crash"
```

#### Cách 2: Dùng Web Interface

1. Vào: https://github.com/Nguyenkiettuan1/phanlaw-capture/releases/new
2. Tag: `v1.0.13`
3. Title: `Version 1.0.13`
4. Description: Nhập release notes
5. Upload files:
   - `Test Automation Screen Auto-Setup-1.0.13.exe`
   - `Test Automation Screen Auto-Setup-1.0.13.exe.blockmap`
   - `latest.yml`
6. Click "Publish release"

---

## 📝 Checklist Trước Khi Release

- [ ] Đã test app ở chế độ production (`npm run build-win` và test)
- [ ] Đã commit tất cả thay đổi
- [ ] Đã kiểm tra repo name trong `package.json` đúng
- [ ] Đã đăng nhập GitHub CLI (`gh auth login`)
- [ ] Đã chuẩn bị release notes
- [ ] Đã backup code (nếu cần)

---

## 🐛 Troubleshooting

### Lỗi: "gh: command not found"

**Giải pháp:**
```bash
# Cài đặt GitHub CLI
winget install GitHub.cli

# Hoặc tải từ: https://cli.github.com/
```

---

### Lỗi: "Authentication failed"

**Giải pháp:**
```bash
# Đăng nhập lại
gh auth login

# Hoặc kiểm tra token
gh auth status
```

---

### Lỗi: "Repository not found"

**Giải pháp:**
- Kiểm tra repo name trong `package.json`:
  ```json
  "repo": "phanlaw-capture"  // ← Phải đúng
  ```
- Kiểm tra bạn có quyền truy cập repo không

---

### Lỗi: "Build failed"

**Giải pháp:**
```bash
# Xóa thư mục dist và build lại
rm -rf dist
npm run build-win

# Hoặc trên Windows:
rmdir /s dist
npm run build-win
```

---

### Lỗi: "File not found" khi tạo release

**Giải pháp:**
- Kiểm tra file có trong `dist/` không:
  ```bash
  ls dist/
  # Hoặc trên Windows:
  dir dist
  ```
- Đảm bảo tên file đúng format:
  ```
  Test Automation Screen Auto-Setup-1.0.13.exe
  Test Automation Screen Auto-Setup-1.0.13.exe.blockmap
  latest.yml
  ```

---

### Release Thành Công Nhưng Không Có Auto-Update

**Kiểm tra:**
1. ✅ File `latest.yml` có trong GitHub Release không?
2. ✅ Tag name có đúng format `v1.0.13` không?
3. ✅ Release type là "release" (không phải "prerelease")?
4. ✅ App đã được cài đặt bằng NSIS installer (không phải portable)?

---

## 📊 Quy Trình Release Hoàn Chỉnh

```
1. Code thay đổi
   ↓
2. Test app
   ↓
3. npm run release:patch
   ↓
4. Script tự động:
   - Tăng version
   - Commit & tag
   - Push GitHub
   - Build app
   - Tạo release
   ↓
5. Người dùng nhận thông báo cập nhật
   ↓
6. Người dùng cập nhật tự động
```

---

## 🎯 Tóm Tắt Nhanh

### Release Patch Version:
```bash
npm run release:patch
```

### Release Minor Version:
```bash
npm run release:minor
```

### Release Major Version:
```bash
npm run release:major
```

**Chỉ cần 1 lệnh, script sẽ làm tất cả!** 🎉

---

## 📚 Tài Liệu Tham Khảo

- [GitHub CLI Documentation](https://cli.github.com/)
- [electron-builder Documentation](https://www.electron.build/)
- [Semantic Versioning](https://semver.org/)

---

**Lưu ý:** Luôn test app trước khi release để đảm bảo không có lỗi!

