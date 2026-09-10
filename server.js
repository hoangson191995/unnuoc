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

// Route /ping siêu nhẹ để UptimeRobot giữ ấm server 24/7 mà không tốn tài nguyên DB
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// --- 1. KHAI BÁO SCHEMA THEO NGÀY ---
const dayWaterSchema = new mongoose.Schema({
    dateString: { type: String, required: true, unique: true }, // VD: "09/09/2026"
    amount: { type: Number, default: 0 },                       // Tổng ml trong ngày
    checked1300: { type: Boolean, default: false },             // Đã hiện popup 1300ml chưa
    checked1500: { type: Boolean, default: false },             // Đã hiện popup 1500ml chưa
    checked2000: { type: Boolean, default: false },             // Đã hiện popup 2000ml chưa
    notes: { type: [String], default: [] }                      // Ghi chú món uống ngoài nước lọc
});
const DayWater = mongoose.model('DayWater', dayWaterSchema);

// Hàm lấy ngày theo múi giờ Việt Nam (UTC+7) để tránh lệch ngày do server Render chạy giờ UTC
function getTodayVN() {
    return new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// Hàm tính chuỗi ngày uống nước liên tiếp (mỗi ngày >= 1500ml)
function calculateStreak(records, todayStr) {
    const recordMap = new Map();
    records.forEach(r => recordMap.set(r.dateString, r.amount));

    function parseDate(str) {
        const [d, m, y] = str.split('/').map(Number);
        return new Date(y, m - 1, d);
    }

    function formatDate(d) {
        return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    }

    const todayDate = parseDate(todayStr);
    const todayAmount = recordMap.get(todayStr) || 0;
    const STREAK_THRESHOLD = 1500;

    let streak = 0;
    let checkDate = new Date(todayDate);

    if (todayAmount >= STREAK_THRESHOLD) {
        streak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
        while (true) {
            const dateStr = formatDate(checkDate);
            const amount = recordMap.get(dateStr) || 0;
            if (amount >= STREAK_THRESHOLD) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
    } else {
        checkDate.setDate(checkDate.getDate() - 1);
        while (true) {
            const dateStr = formatDate(checkDate);
            const amount = recordMap.get(dateStr) || 0;
            if (amount >= STREAK_THRESHOLD) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
    }

    return streak;
}

// --- 2. CÁC API ROUTING ---

// API lấy dữ liệu ngày hôm nay (kèm chuỗi ngày streak)
app.get('/api/water/today', async (req, res) => {
    try {
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });

        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0, notes: [] });
            await record.save();
        }

        const allRecords = await DayWater.find();
        const streak = calculateStreak(allRecords, todayStr);

        res.status(200).json({ ...record.toObject(), streak });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API thêm nước và kiểm tra mốc thành tích (hỗ trợ kèm ghi chú)
app.post('/api/water/add', async (req, res) => {
    try {
        const { amount, note } = req.body;
        const todayStr = getTodayVN();

        let record = await DayWater.findOne({ dateString: todayStr });
        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0, notes: [] });
        }

        let oldAmount = record.amount;
        record.amount += Number(amount || 0);
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

        // Lưu ghi chú nếu có
        if (note && typeof note === 'string' && note.trim()) {
            if (!record.notes) record.notes = [];
            record.notes.push(note.trim());
        }

        await record.save();
        const allRecords = await DayWater.find();
        const streak = calculateStreak(allRecords, todayStr);
        res.status(200).json({ record, milestoneReached, streak });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API lưu ghi chú món uống riêng lẻ
app.post('/api/water/note', async (req, res) => {
    try {
        const { note } = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({ error: "Bà chã chưa nhập ghi chú nè!" });
        }
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });
        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0, notes: [] });
        }
        if (!record.notes) record.notes = [];
        record.notes.push(note.trim());

        await record.save();
        res.status(200).json({ message: "Đã lưu ghi chú thành công!", record });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API xóa 1 ghi chú món uống theo thứ tự (index)
app.post('/api/water/note/delete', async (req, res) => {
    try {
        const idx = parseInt(req.body.index, 10);
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });

        if (!record || !record.notes || isNaN(idx) || idx < 0 || idx >= record.notes.length) {
            return res.status(400).json({ error: "Không tìm thấy ghi chú để xóa!" });
        }

        record.notes.splice(idx, 1);
        await record.save();
        res.status(200).json({ message: "Đã xóa món thành công!", record });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/water/note/:index', async (req, res) => {
    try {
        const idx = parseInt(req.params.index, 10);
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });

        if (!record || !record.notes || isNaN(idx) || idx < 0 || idx >= record.notes.length) {
            return res.status(400).json({ error: "Không tìm thấy ghi chú để xóa!" });
        }

        record.notes.splice(idx, 1);
        await record.save();
        res.status(200).json({ message: "Đã xóa món thành công!", record });
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
        const allRecords = await DayWater.find();
        const streak = calculateStreak(allRecords, todayStr);
        res.status(200).json({ message: "Đã đặt lại về 0 ml thành công!", record, streak });
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