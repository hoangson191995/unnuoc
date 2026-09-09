const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ giao diện web trực tiếp từ server
app.use(express.static(__dirname));

// Kiểm tra biến môi trường
if (!process.env.MONGODB_URI) {
    console.error("❌ CẢNH BÁO: Chưa tìm thấy biến môi trường MONGODB_URI! Hãy kiểm tra file .env hoặc cấu hình trên Render.");
}

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Đã kết nối Database thành công! 🌸"))
    .catch(err => console.log("Lỗi kết nối DB:", err.message));

// Route trang chủ hiển thị index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 1. KHAI BÁO SCHEMA THEO NGÀY ---
const dayWaterSchema = new mongoose.Schema({
    dateString: { type: String, required: true, unique: true }, // VD: "09/09/2026"
    amount: { type: Number, default: 0 },                       // Tổng ml trong ngày
    checked1300: { type: Boolean, default: false },             // Đã hiện popup 1300ml chưa
    checked1500: { type: Boolean, default: false },             // Đã hiện popup 1500ml chưa
    checked2000: { type: Boolean, default: false }              // Đã hiện popup 2000ml chưa
});
const DayWater = mongoose.model('DayWater', dayWaterSchema);

// Hàm lấy ngày theo múi giờ Việt Nam (UTC+7) để tránh lệch ngày do server Render chạy giờ UTC
function getTodayVN() {
    return new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// --- 2. CÁC API ROUTING ---

// API lấy dữ liệu ngày hôm nay
app.get('/api/water/today', async (req, res) => {
    try {
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });

        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0 });
            await record.save();
        }
        res.status(200).json(record);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API thêm nước và kiểm tra mốc thành tích
app.post('/api/water/add', async (req, res) => {
    try {
        const { amount } = req.body;
        const todayStr = getTodayVN();

        let record = await DayWater.findOne({ dateString: todayStr });
        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0 });
        }

        let oldAmount = record.amount;
        record.amount += amount;
        let newAmount = record.amount;

        let milestoneReached = null;

        // Kiểm tra mốc tương ứng với văn phong của bạn
        if (oldAmount < 1300 && newAmount >= 1300 && !record.checked1300) {
            record.checked1300 = true;
            milestoneReached = { title: "💧 Tạm được nho!", desc: "Tạm chấp nhận nha bà chã! Thêm tí nữa nèo! 💪" };
        } else if (oldAmount < 1500 && newAmount >= 1500 && !record.checked1500) {
            record.checked1500 = true;
            milestoneReached = { title: "🌸 Đạt yêu cầu!", desc: "Ăm chã duyệt nhee! ✨" };
        } else if (oldAmount < 2000 && newAmount >= 2000 && !record.checked2000) {
            record.checked2000 = true;
            milestoneReached = { title: "🎉 Quá giỏiii!", desc: "Iu bà chãaa 💖🏆" };
        }

        await record.save();
        res.status(200).json({ record, milestoneReached });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API đặt lại (reset) lượng nước ngày hôm nay về 0
app.post('/api/water/reset', async (req, res) => {
    try {
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });

        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0 });
        } else {
            record.amount = 0;
            record.checked1300 = false;
            record.checked1500 = false;
            record.checked2000 = false;
        }

        await record.save();
        res.status(200).json({ message: "Đã đặt lại về 0 ml thành công!", record });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API lấy toàn bộ lịch sử các ngày (cho nút "Coi lại ngày cũ")
app.get('/api/water/history', async (req, res) => {
    try {
        const history = await DayWater.find().sort({ _id: -1 });
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server đang chạy tại http://localhost:${PORT}`));