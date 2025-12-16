# 📦 Hướng Dẫn Cơ Chế Tự Động Cập Nhật

## 🔍 Tổng Quan

Ứng dụng Electron này sử dụng thư viện **electron-updater** để tự động kiểm tra và cập nhật phiên bản mới từ GitHub Releases. Hệ thống hoạt động hoàn toàn tự động, người dùng không cần phải tải về thủ công.

---

## ⚙️ Cơ Chế Hoạt Động

### 1. **Kiểm Tra Cập Nhật**

#### Khi Nào Kiểm Tra?
- ✅ **Khi khởi động app**: Sau 3 giây (kiểm tra im lặng, không làm phiền người dùng)
- ✅ **Định kỳ**: Tự động kiểm tra mỗi 4 giờ
- ✅ **Kiểm tra thủ công**: Người dùng có thể nhấn nút "Check for Updates" trong Settings

#### Cách Kiểm Tra:
```javascript
// App tự động đọc cấu hình từ package.json
"publish": {
  "provider": "github",
  "owner": "Nguyenkiettuan1",
  "repo": "phanlaw-capture",
  "releaseType": "release"
}
```

App sẽ:
1. Kết nối đến GitHub API
2. Tìm release mới nhất trong repo `phanlaw-capture`
3. Đọc file `latest.yml` để so sánh version
4. So sánh với version hiện tại trong `package.json`

---

### 2. **Quy Trình Cập Nhật**

#### Bước 1: Phát Hiện Phiên Bản Mới
```
App đang chạy (v1.0.12)
    ↓
Kiểm tra GitHub Releases
    ↓
Tìm thấy v1.0.13
    ↓
So sánh: 1.0.13 > 1.0.12 → CÓ CẬP NHẬT!
```

**Sự kiện:** `update-available`
- Hiển thị thông báo: "Phiên bản mới (1.0.13) đang được tải xuống!"
- Tự động bắt đầu tải xuống (không cần hỏi)

#### Bước 2: Tải Xuống Cập Nhật
```
Bắt đầu tải file .exe từ GitHub Releases
    ↓
Hiển thị tiến trình: 0% → 100%
    ↓
Lưu vào thư mục tạm của Windows
```

**Sự kiện:** `download-progress`
- Hiển thị: "📥 Đang tải cập nhật: 45% (12.5MB / 28MB)"
- Cập nhật real-time trong notification

#### Bước 3: Hoàn Tất Tải Xuống
```
File đã tải xong
    ↓
Hiển thị dialog: "Khởi động lại ngay" hoặc "Sau"
```

**Sự kiện:** `update-downloaded`
- Nếu chọn "Khởi động lại ngay": App sẽ đóng và cài đặt ngay
- Nếu chọn "Sau": Cập nhật sẽ được cài đặt khi đóng app lần sau

#### Bước 4: Cài Đặt Cập Nhật
```
App đóng
    ↓
NSIS installer chạy
    ↓
Cài đặt phiên bản mới
    ↓
Khởi động lại app với phiên bản mới
```

---

## 📋 Cấu Hình Chi Tiết

### File: `main.js` - Setup Auto-Updater

```javascript
setupAutoUpdater() {
    // 1. Tắt trong chế độ development
    if (this.isDev) return;
    
    // 2. Bật tự động tải xuống
    autoUpdater.autoDownload = true;
    
    // 3. Tự động cài đặt khi đóng app
    autoUpdater.autoInstallOnAppQuit = true;
    
    // 4. Kiểm tra định kỳ mỗi 4 giờ
    setInterval(() => {
        this.checkForUpdates(false);
    }, 4 * 60 * 60 * 1000);
    
    // 5. Xử lý các sự kiện
    autoUpdater.on('update-available', ...);
    autoUpdater.on('download-progress', ...);
    autoUpdater.on('update-downloaded', ...);
    autoUpdater.on('error', ...);
}
```

### File: `package.json` - Cấu Hình Build

```json
{
  "build": {
    "appId": "com.testautomation.screenauto",
    "publish": {
      "provider": "github",
      "owner": "Nguyenkiettuan1",
      "repo": "phanlaw-capture"
    },
    "win": {
      "target": [
        { "target": "nsis" },  // ← Quan trọng: Phải dùng NSIS!
        { "target": "portable" }
      ]
    }
  }
}
```

---

## 🚨 Lưu Ý Quan Trọng

### ⚠️ 1. Phải Dùng NSIS Installer

**❌ KHÔNG hoạt động:**
- Portable version (.exe không cần cài đặt)
- Zip file giải nén
- App chạy trực tiếp từ thư mục source code

**✅ CHỈ hoạt động với:**
- NSIS Installer (.exe setup file)
- App đã được cài đặt vào hệ thống Windows
- App chạy từ Program Files hoặc AppData

**Lý do:** electron-updater cần quyền ghi vào thư mục cài đặt để cập nhật. Portable version không có thư mục cài đặt cố định.

---

### ⚠️ 2. File `latest.yml` Phải Có Trong GitHub Release

Khi build, electron-builder tự động tạo 3 file:
1. ✅ `Test Automation Screen Auto-Setup-1.0.13.exe` - File cài đặt
2. ✅ `Test Automation Screen Auto-Setup-1.0.13.exe.blockmap` - File checksum
3. ✅ `latest.yml` - **File metadata quan trọng nhất!**

**File `latest.yml` chứa:**
```yaml
version: 1.0.13
files:
  - url: Test Automation Screen Auto-Setup-1.0.13.exe
    sha512: abc123...
    size: 29384756
path: Test Automation Screen Auto-Setup-1.0.13.exe
sha512: abc123...
releaseDate: '2024-01-15T10:30:00.000Z'
```

**App đọc file này để:**
- Biết version mới nhất
- Kiểm tra checksum (đảm bảo file không bị hỏng)
- Tải đúng file cần thiết

**⚠️ Nếu thiếu `latest.yml`:**
- App không thể kiểm tra cập nhật
- Sẽ báo lỗi: "Cannot find latest.yml"

---

### ⚠️ 3. GitHub Token và Quyền Truy Cập

**Cần có:**
- GitHub Personal Access Token với quyền `repo`
- Token được cấu hình trong environment variable hoặc GitHub Actions

**Kiểm tra:**
```bash
# Windows PowerShell
$env:GH_TOKEN = "your_token_here"

# Hoặc trong GitHub Actions
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Nếu không có token:**
- Build sẽ thành công
- Nhưng không thể upload lên GitHub Releases
- Phải upload thủ công

---

### ⚠️ 4. Version Phải Tăng Dần

**Quy tắc Semantic Versioning:**
```
MAJOR.MINOR.PATCH
  1  .  0  .  12
```

- **PATCH** (1.0.12 → 1.0.13): Bug fixes
- **MINOR** (1.0.12 → 1.1.0): New features
- **MAJOR** (1.0.12 → 2.0.0): Breaking changes

**❌ KHÔNG được:**
- Giảm version (1.0.13 → 1.0.12)
- Version không hợp lệ (1.0.13a, 1.0.13-beta)

**✅ Phải:**
- Luôn tăng version
- Format: `X.Y.Z` (số nguyên)

---

### ⚠️ 5. GitHub Release Phải Đúng Format

**Cấu trúc Release:**
```
Release v1.0.13
├── Test Automation Screen Auto-Setup-1.0.13.exe
├── Test Automation Screen Auto-Setup-1.0.13.exe.blockmap
└── latest.yml
```

**Tag name:** Phải là `v1.0.13` (có chữ "v" ở đầu)

**Release type:** Phải là "release" (không phải "prerelease" hoặc "draft")

---

### ⚠️ 6. Kiểm Tra Cài Đặt Trong Settings

App có setting để bật/tắt auto-update:
- `checkUpdatesOnStartup`: true/false
- Nếu tắt, app sẽ không tự động kiểm tra
- Nhưng vẫn có thể kiểm tra thủ công

---

### ⚠️ 7. Xử Lý Lỗi Mạng

**Khi offline hoặc mất kết nối:**
- App không hiển thị lỗi (để không làm phiền)
- Sẽ tự động thử lại ở lần kiểm tra tiếp theo
- Không ảnh hưởng đến việc sử dụng app

**Lỗi được bỏ qua:**
- `net::ERR_INTERNET_DISCONNECTED`
- `net::ERR_NETWORK_CHANGED`
- `ENOTFOUND`

---

## 🔧 Quy Trình Phát Hành Phiên Bản Mới

### Cách 1: Dùng Script Tự Động (Khuyến nghị)

```bash
# Tăng version patch (1.0.12 → 1.0.13)
npm run release:patch

# Tăng version minor (1.0.12 → 1.1.0)
npm run release:minor

# Tăng version major (1.0.12 → 2.0.0)
npm run release:major
```

**Script sẽ tự động:**
1. ✅ Tăng version trong `package.json`
2. ✅ Commit và tag Git
3. ✅ Push lên GitHub
4. ✅ Build app với electron-builder
5. ✅ Tạo GitHub Release
6. ✅ Upload file .exe, .blockmap, và latest.yml

### Cách 2: Thủ Công

```bash
# 1. Tăng version trong package.json
# "version": "1.0.13"

# 2. Build app
npm run build-win

# 3. Kiểm tra file trong thư mục dist/
# - Test Automation Screen Auto-Setup-1.0.13.exe
# - Test Automation Screen Auto-Setup-1.0.13.exe.blockmap
# - latest.yml

# 4. Tạo GitHub Release
gh release create v1.0.13 \
  dist/Test\ Automation\ Screen\ Auto-Setup-1.0.13.exe \
  dist/Test\ Automation\ Screen\ Auto-Setup-1.0.13.exe.blockmap \
  dist/latest.yml \
  --title "Version 1.0.13" \
  --notes "Bug fixes and improvements"
```

---

## 🐛 Troubleshooting

### Vấn Đề 1: App Không Kiểm Tra Cập Nhật

**Nguyên nhân có thể:**
- ❌ Đang chạy ở chế độ development (`npm start`)
- ❌ Setting `checkUpdatesOnStartup` bị tắt
- ❌ Không có kết nối internet
- ❌ GitHub token không đúng

**Giải pháp:**
```javascript
// Kiểm tra trong console
console.log('Is Dev:', process.argv.includes('--dev'));
console.log('Settings:', settings.checkUpdatesOnStartup);
```

---

### Vấn Đề 2: Không Tìm Thấy latest.yml

**Nguyên nhân:**
- File `latest.yml` không được upload lên GitHub Release
- Tên file không đúng

**Giải pháp:**
- Kiểm tra GitHub Release có file `latest.yml`
- Đảm bảo file được upload cùng với .exe

---

### Vấn Đề 3: Cập Nhật Không Cài Đặt Được

**Nguyên nhân:**
- App không được cài đặt bằng NSIS installer
- Thiếu quyền ghi vào thư mục cài đặt
- File bị hỏng hoặc không đúng checksum

**Giải pháp:**
- Cài đặt lại app bằng NSIS installer
- Chạy app với quyền Administrator (nếu cần)
- Kiểm tra file .blockmap có đúng không

---

### Vấn Đề 4: Lỗi "Cannot check for updates"

**Nguyên nhân:**
- GitHub API rate limit
- Repo không tồn tại hoặc không public
- Token không có quyền

**Giải pháp:**
- Kiểm tra repo: `https://github.com/Nguyenkiettuan1/phanlaw-capture`
- Kiểm tra token có quyền `repo`
- Đợi một lúc rồi thử lại (rate limit)

---

## 📊 Luồng Dữ Liệu

```
┌─────────────────┐
│   App đang chạy │
│   (v1.0.12)     │
└────────┬────────┘
         │
         │ Kiểm tra mỗi 4 giờ
         ↓
┌─────────────────┐
│  GitHub API     │
│  /releases/latest│
└────────┬────────┘
         │
         │ Trả về latest.yml
         ↓
┌─────────────────┐
│  So sánh version│
│  1.0.13 > 1.0.12│
└────────┬────────┘
         │
         │ Có cập nhật!
         ↓
┌─────────────────┐
│  Tải file .exe  │
│  từ GitHub      │
└────────┬────────┘
         │
         │ Tải xong
         ↓
┌─────────────────┐
│  Hỏi người dùng │
│  Khởi động lại? │
└────────┬────────┘
         │
         │ Có
         ↓
┌─────────────────┐
│  Cài đặt cập nhật│
│  Khởi động lại  │
└─────────────────┘
```

---

## ✅ Checklist Trước Khi Phát Hành

- [ ] Version đã được tăng trong `package.json`
- [ ] Đã test app ở chế độ production
- [ ] GitHub token đã được cấu hình
- [ ] Build thành công không có lỗi
- [ ] File `latest.yml` được tạo trong `dist/`
- [ ] GitHub Release được tạo với đúng tag (`v1.0.13`)
- [ ] Tất cả file (.exe, .blockmap, latest.yml) được upload
- [ ] Release notes đã được điền
- [ ] Đã test auto-update trên máy khác

---

## 📚 Tài Liệu Tham Khảo

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [electron-builder Configuration](https://www.electron.build/configuration/configuration)
- [GitHub Releases API](https://docs.github.com/en/rest/releases/releases)

---

**Lưu ý cuối:** Hệ thống auto-update chỉ hoạt động với NSIS installer. Portable version không hỗ trợ auto-update.

