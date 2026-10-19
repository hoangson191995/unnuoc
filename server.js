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
const timelineItemSchema = new mongoose.Schema({
    time: { type: String, required: true },     // VD: "08:30"
    amount: { type: Number, default: 0 },       // Lượng nước lọc (ml)
    note: { type: String, default: "Nước lọc" },// Tên món (VD: "Nước lọc 💧", "Trà đào")
    type: { type: String, default: "water" },   // "water" (nước lọc) hoặc "other" (món ngoài nước lọc)
    createdAt: { type: Date, default: Date.now }
});

const dayWaterSchema = new mongoose.Schema({
    dateString: { type: String, required: true, unique: true }, // VD: "09/09/2026"
    amount: { type: Number, default: 0 },                       // Tổng ml trong ngày
    checked1300: { type: Boolean, default: false },             // Đã hiện popup 1300ml chưa
    checked1500: { type: Boolean, default: false },             // Đã hiện popup 1500ml chưa
    checked2000: { type: Boolean, default: false },             // Đã hiện popup 2000ml chưa
    isRecovered: { type: Boolean, default: false },             // Đã dùng vé cứu chuỗi chưa
    recoveredAt: { type: Date },                                // Thời điểm dùng vé cứu
    notes: { type: [String], default: [] },                     // Ghi chú món uống ngoài nước lọc
    timeline: { type: [timelineItemSchema], default: [] }       // Dòng thời gian trong ngày
});
const DayWater = mongoose.model('DayWater', dayWaterSchema);

// Schema lưu số lần dùng vé cứu chuỗi (tối đa 3 lần / tháng)
const streakRecoverySchema = new mongoose.Schema({
    monthYear: { type: String, required: true, unique: true }, // VD: "10/2026"
    usedCount: { type: Number, default: 0 },                    // Số lần đã dùng trong tháng này (tối đa 3)
    history: [{
        dateString: String,
        recoveredAt: { type: Date, default: Date.now }
    }]
});
const StreakRecovery = mongoose.model('StreakRecovery', streakRecoverySchema);

// Hàm lấy ngày theo múi giờ Việt Nam (UTC+7) để tránh lệch ngày do server Render chạy giờ UTC
function getTodayVN() {
    return new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// Hàm lấy tháng/năm theo múi giờ Việt Nam (VD: "10/2026")
function getMonthYearVN() {
    const today = getTodayVN();
    const parts = today.split('/');
    return `${parts[1]}/${parts[2]}`;
}

// Hàm lấy thông tin vé cứu chuỗi trong tháng hiện tại
async function getMonthlyRecoveryInfo() {
    const monthYear = getMonthYearVN();
    let record = await StreakRecovery.findOne({ monthYear });
    if (!record) {
        record = new StreakRecovery({ monthYear, usedCount: 0, history: [] });
        await record.save();
    }
    const maxPerMonth = 3;
    const remaining = Math.max(0, maxPerMonth - record.usedCount);
    return {
        monthYear,
        maxPerMonth,
        usedCount: record.usedCount,
        remaining,
        history: record.history
    };
}

// Hàm chuẩn hóa chuỗi ngày d/m/y
function normalizeDateStr(str) {
    if (!str) return '';
    const parts = str.split('/').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return str;
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

// Hàm lấy giờ phút theo múi giờ Việt Nam (UTC+7) cho dòng thời gian
function getNowTimeVN() {
    return new Date().toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// Hàm tính chuỗi ngày uống nước liên tiếp (mỗi ngày >= 1500ml HOẶC được dùng vé cứu chuỗi)
function calculateStreak(records, todayStr) {
    const recordMap = new Map();
    const recoveredSet = new Set();
    records.forEach(r => {
        if (r.dateString) {
            const key = normalizeDateStr(r.dateString);
            recordMap.set(key, r.amount || 0);
            if (r.isRecovered) recoveredSet.add(key);
        }
    });

    function parseDate(str) {
        const [d, m, y] = str.split('/').map(Number);
        return new Date(y, m - 1, d);
    }

    function formatDateKey(d) {
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }

    const STREAK_THRESHOLD = 1500;
    function isQualified(d) {
        const key = formatDateKey(d);
        return (recordMap.get(key) || 0) >= STREAK_THRESHOLD || recoveredSet.has(key);
    }

    const todayDate = parseDate(todayStr);
    const todayQualified = isQualified(todayDate);

    let streak = 0;
    let checkDate = new Date(todayDate);

    if (todayQualified) {
        streak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
        while (isQualified(checkDate)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
    } else {
        checkDate.setDate(checkDate.getDate() - 1);
        while (isQualified(checkDate)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
    }

    return streak;
}

// Kiểm tra xem chuỗi có vừa bị đứt hôm qua không để đề xuất dùng vé cứu chuỗi
function checkStreakRecoveryStatus(records, todayStr, remainingRecoveries) {
    const recordMap = new Map();
    const recoveredSet = new Set();
    records.forEach(r => {
        if (r.dateString) {
            const key = normalizeDateStr(r.dateString);
            recordMap.set(key, r.amount || 0);
            if (r.isRecovered) recoveredSet.add(key);
        }
    });

    const [d, m, y] = todayStr.split('/').map(Number);
    const todayDate = new Date(y, m - 1, d);

    function formatDateKey(dt) {
        return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
    }

    function formatDisplayDate(dt) {
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    }

    const STREAK_THRESHOLD = 1500;
    function isQualified(dt) {
        const key = formatDateKey(dt);
        return (recordMap.get(key) || 0) >= STREAK_THRESHOLD || recoveredSet.has(key);
    }

    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(todayDate.getDate() - 1);
    const yesterdayQualified = isQualified(yesterdayDate);
    const yesterdayDisplay = formatDisplayDate(yesterdayDate);

    // Nếu hôm qua đã đạt chuẩn rồi thì chuỗi không bị đứt
    if (yesterdayQualified) {
        return {
            canRecover: false,
            targetDateStr: null,
            brokenStreak: 0
        };
    }

    // Hôm qua chưa đạt chuẩn: kiểm tra xem trước hôm qua có chuỗi >= 1 ngày không
    let checkDate = new Date(yesterdayDate);
    checkDate.setDate(yesterdayDate.getDate() - 1);
    let previousStreak = 0;
    while (isQualified(checkDate)) {
        previousStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Có thể cứu chuỗi nếu còn vé trong tháng và trước đó đã có chuỗi >= 1 ngày bị đứt
    const canRecover = remainingRecoveries > 0 && previousStreak >= 1;

    return {
        canRecover,
        targetDateStr: yesterdayDisplay,
        brokenStreak: previousStreak
    };
}

// Danh mục 8 loài cây kỳ diệu bí ẩn xoay vòng theo tuần
const PLANTS_CATALOG = [
    { id: "sunflower", name: "Cây Hướng Dương Mặt Trời", icon: "🌻", desc: "Bà chã luôn tỏa nắng rạng rỡ sưởi ấm trái tim ăm chã ☀️" },
    { id: "candy", name: "Cây Kẹo Ngọt Tình Yêu", icon: "🍭", desc: "Ngọt ngào như tình cảm của ăm chã dành riêng cho bà chã 🍬" },
    { id: "heart", name: "Cây Trái Tim Vĩnh Cửu", icon: "💖", desc: "Từng chiếc lá đều là một nhịp tim ăm chã rung động vì bà chã 💕" },
    { id: "milktea", name: "Cây Trà Sữa Thần Kỳ", icon: "🧋", desc: "Bà chã chăm uống nước ngoan là cây biến ra ly trà sữa thơm lừng 🥤" },
    { id: "cherry", name: "Cây Hoa Anh Đào Mộng Mơ", icon: "🌸", desc: "Xinh xắn, dịu dàng và đáng yêu y hệt bà chã vậy đó 🌸" },
    { id: "strawberry", name: "Cây Dâu Tây Ngọt Lịm", icon: "🍓", desc: "Trái dâu chín mọng ngọt lành tiếp thêm vitamin da xinh cho bà chã 🍓" },
    { id: "clover", name: "Cây Cỏ Bốn Lá May Mắn", icon: "🍀", desc: "Mang lại vạn điều may mắn và niềm vui tới bà chã mỗi ngày 🍀" },
    { id: "crystal", name: "Cây Pha Lê Băng Tuyết", icon: "💎", desc: "Lấp lánh và quý giá nhất trần đời trong mắt ăm chã 💎✨" }
];

// Hàm tính toán Cây Kỳ Diệu của tuần hiện tại
function calculateWeeklyPlant(allRecords, todayStr) {
    function normalizeDateStr(str) {
        if (!str) return '';
        const parts = str.split('/').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return str;
        return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }

    const recordMap = new Map();
    const recoveredSet = new Set();
    allRecords.forEach(r => {
        if (r.dateString) {
            const key = normalizeDateStr(r.dateString);
            recordMap.set(key, r.amount);
            if (r.isRecovered) recoveredSet.add(key);
        }
    });

    const [d, m, y] = todayStr.split('/').map(Number);
    const todayDate = new Date(y, m - 1, d);
    const dayOfWeek = todayDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + diffToMonday);

    const oneJan = new Date(monday.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((monday - oneJan) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((monday.getDay() + 1 + numberOfDays) / 7);
    const weekId = `${monday.getFullYear()}-W${weekNum}`;

    const plantIndex = Math.abs(weekNum) % PLANTS_CATALOG.length;
    const plant = PLANTS_CATALOG[plantIndex];

    const days = [];
    const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    let completedDays = 0;

    for (let i = 0; i < 7; i++) {
        const curDate = new Date(monday);
        curDate.setDate(monday.getDate() + i);
        const normKey = `${curDate.getDate()}/${curDate.getMonth() + 1}/${curDate.getFullYear()}`;
        const displayDateStr = `${String(curDate.getDate()).padStart(2, '0')}/${String(curDate.getMonth() + 1).padStart(2, '0')}/${curDate.getFullYear()}`;
        const amount = recordMap.get(normKey) || 0;
        const isCompleted = amount >= 1500 || recoveredSet.has(normKey);
        if (isCompleted) completedDays++;

        const isToday = (normKey === normalizeDateStr(todayStr));
        const isPast = curDate < todayDate && !isToday;

        days.push({
            label: dayNames[i],
            dateString: displayDateStr,
            amount,
            completed: isCompleted,
            isToday,
            isPast
        });
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekRange = `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')} - ${String(sunday.getDate()).padStart(2, '0')}/${String(sunday.getMonth() + 1).padStart(2, '0')}`;

    const STAGE_ICONS = ["🌰", "🌱", "🌿", "🪴", "🌷", "🌺", "💐", plant.icon];
    const stageIcon = completedDays >= 7 ? plant.icon : STAGE_ICONS[completedDays];

    return {
        weekId,
        weekRange,
        weekNum,
        plant,
        completedDays,
        stageIcon,
        isFullyGrown: completedDays >= 4,
        isMaster: completedDays === 7,
        days
    };
}

// Hàm gom dữ liệu chung trả về cho Frontend (streak, cây tuần, vé cứu chuỗi)
async function getCommonWaterData(allRecords, todayStr) {
    const streak = calculateStreak(allRecords, todayStr);
    const weeklyPlant = calculateWeeklyPlant(allRecords, todayStr);
    const recoveryInfo = await getMonthlyRecoveryInfo();
    const recoveryStatus = checkStreakRecoveryStatus(allRecords, todayStr, recoveryInfo.remaining);
    return {
        streak,
        weeklyPlant,
        streakRecovery: {
            ...recoveryInfo,
            ...recoveryStatus
        }
    };
}

// --- 2. CÁC API ROUTING ---

// API lấy dữ liệu ngày hôm nay (kèm chuỗi streak, cây tuần, vé cứu chuỗi)
app.get('/api/water/today', async (req, res) => {
    try {
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });

        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0, notes: [], timeline: [] });
            await record.save();
        }

        const allRecords = await DayWater.find();
        const commonData = await getCommonWaterData(allRecords, todayStr);

        res.status(200).json({ ...record.toObject(), ...commonData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API thêm nước lọc và kiểm tra mốc thành tích (ghi vào dòng thời gian)
app.post('/api/water/add', async (req, res) => {
    try {
        const { amount } = req.body;
        const todayStr = getTodayVN();

        let record = await DayWater.findOne({ dateString: todayStr });
        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0, notes: [], timeline: [] });
        }

        const addMl = Number(amount || 0);
        let oldAmount = record.amount;
        record.amount += addMl;
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

        // Ghi lại vào dòng thời gian (chỉ nước lọc mới có ml)
        if (!record.timeline) record.timeline = [];
        record.timeline.push({
            time: getNowTimeVN(),
            amount: addMl,
            note: "Nước lọc 💧",
            type: "water"
        });

        await record.save();
        const allRecords = await DayWater.find();
        const commonData = await getCommonWaterData(allRecords, todayStr);
        res.status(200).json({ record, milestoneReached, ...commonData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API lưu ghi chú món uống riêng lẻ (KHÔNG CỘNG ML)
app.post('/api/water/note', async (req, res) => {
    try {
        const { note } = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({ error: "Bà chã chưa nhập ghi chú nè!" });
        }
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });
        if (!record) {
            record = new DayWater({ dateString: todayStr, amount: 0, notes: [], timeline: [] });
        }
        if (!record.notes) record.notes = [];
        const cleanNote = note.trim();
        record.notes.push(cleanNote);

        // Ghi vào dòng thời gian với amount = 0 (món ngoài nước lọc)
        if (!record.timeline) record.timeline = [];
        record.timeline.push({
            time: getNowTimeVN(),
            amount: 0,
            note: cleanNote,
            type: "other"
        });

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

        const removedNote = record.notes.splice(idx, 1)[0];
        if (record.timeline && record.timeline.length > 0) {
            const tIdx = record.timeline.findIndex(t => t.type === 'other' && t.note === removedNote);
            if (tIdx !== -1) {
                record.timeline.splice(tIdx, 1);
            }
        }

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

        const removedNote = record.notes.splice(idx, 1)[0];
        if (record.timeline && record.timeline.length > 0) {
            const tIdx = record.timeline.findIndex(t => t.type === 'other' && t.note === removedNote);
            if (tIdx !== -1) {
                record.timeline.splice(tIdx, 1);
            }
        }

        await record.save();
        res.status(200).json({ message: "Đã xóa món thành công!", record });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API xóa 1 mục trong dòng thời gian hôm nay (có trừ lại ml nếu là nước lọc)
app.post('/api/water/timeline/delete', async (req, res) => {
    try {
        const idx = parseInt(req.body.index, 10);
        const todayStr = getTodayVN();
        let record = await DayWater.findOne({ dateString: todayStr });

        if (!record || !record.timeline || isNaN(idx) || idx < 0 || idx >= record.timeline.length) {
            return res.status(400).json({ error: "Không tìm thấy mục trong dòng thời gian để xóa!" });
        }

        const item = record.timeline[idx];
        // Nếu là nước lọc và có lượng ml > 0, trừ lại lượng nước
        if (item.type === 'water' && item.amount > 0) {
            record.amount = Math.max(0, record.amount - item.amount);
            // Cập nhật lại cờ mốc nếu bị giảm xuống dưới mốc
            if (record.amount < 2000) record.checked2000 = false;
            if (record.amount < 1500) record.checked1500 = false;
            if (record.amount < 1300) record.checked1300 = false;
        } else if (item.type === 'other') {
            // Nếu là món ngoài nước lọc, xóa khỏi mảng notes nếu có
            if (record.notes && record.notes.length > 0) {
                const noteIdx = record.notes.indexOf(item.note);
                if (noteIdx !== -1) {
                    record.notes.splice(noteIdx, 1);
                }
            }
        }

        record.timeline.splice(idx, 1);
        await record.save();

        const allRecords = await DayWater.find();
        const commonData = await getCommonWaterData(allRecords, todayStr);
        res.status(200).json({ message: "Đã xóa mục thành công!", record, ...commonData });
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
            record = new DayWater({ dateString: todayStr, amount: 0, notes: [], timeline: [] });
        } else {
            record.amount = 0;
            record.checked1300 = false;
            record.checked1500 = false;
            record.checked2000 = false;
            record.timeline = [];
            record.notes = [];
        }

        await record.save();
        const allRecords = await DayWater.find();
        const commonData = await getCommonWaterData(allRecords, todayStr);
        res.status(200).json({ message: "Đã đặt lại về 0 ml thành công!", record, ...commonData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API khôi phục chuỗi bằng vé cứu chuỗi của Ăm chã (tối đa 3 lần/tháng)
app.post('/api/water/streak/recover', async (req, res) => {
    try {
        const todayStr = getTodayVN();
        const monthYear = getMonthYearVN();
        let recoveryRecord = await StreakRecovery.findOne({ monthYear });
        if (!recoveryRecord) {
            recoveryRecord = new StreakRecovery({ monthYear, usedCount: 0, history: [] });
        }

        if (recoveryRecord.usedCount >= 3) {
            return res.status(400).json({ error: "Tháng này bà chã đã dùng hết 3 lần cứu chuỗi rồi nè! Tháng sau sẽ có thêm vé mới nha 💕" });
        }

        // Xác định ngày cần cứu (mặc định là ngày hôm qua)
        const [td, tm, ty] = todayStr.split('/').map(Number);
        const todayDate = new Date(ty, tm - 1, td);
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setDate(todayDate.getDate() - 1);
        const targetDateStr = `${String(yesterdayDate.getDate()).padStart(2, '0')}/${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}/${yesterdayDate.getFullYear()}`;

        let dayRecord = await DayWater.findOne({ dateString: targetDateStr });
        if (!dayRecord) {
            dayRecord = new DayWater({
                dateString: targetDateStr,
                amount: 0,
                isRecovered: true,
                recoveredAt: new Date(),
                notes: [],
                timeline: []
            });
        } else {
            if (dayRecord.isRecovered) {
                return res.status(400).json({ error: "Ngày này đã được dùng vé cứu chuỗi rồi nha bà chã!" });
            }
            dayRecord.isRecovered = true;
            dayRecord.recoveredAt = new Date();
        }

        await dayRecord.save();

        recoveryRecord.usedCount += 1;
        recoveryRecord.history.push({
            dateString: targetDateStr,
            recoveredAt: new Date()
        });
        await recoveryRecord.save();

        const allRecords = await DayWater.find();
        const todayRecord = await DayWater.findOne({ dateString: todayStr });
        const commonData = await getCommonWaterData(allRecords, todayStr);

        res.status(200).json({
            message: `Ăm chã đã dùng 1 vé cứu chuỗi cho ngày ${targetDateStr}! Chuỗi của bà chã đã được nối lại rực rỡ rùi nhee! 💖🎉`,
            record: todayRecord,
            ...commonData
        });
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

// API lấy danh sách các tuần và cây thu thập (cho Kệ Sưu Tập Cây)
app.get('/api/water/weekly-collection', async (req, res) => {
    try {
        const todayStr = getTodayVN();
        const allRecords = await DayWater.find();

        function normalizeDateStr(str) {
            if (!str) return '';
            const parts = str.split('/').map(Number);
            if (parts.length !== 3 || parts.some(isNaN)) return str;
            return `${parts[0]}/${parts[1]}/${parts[2]}`;
        }

        const recordMap = new Map();
        const recoveredSet = new Set();
        allRecords.forEach(r => {
            if (r.dateString) {
                const key = normalizeDateStr(r.dateString);
                recordMap.set(key, r.amount);
                if (r.isRecovered) recoveredSet.add(key);
            }
        });

        const [td, tm, ty] = todayStr.split('/').map(Number);
        const todayDate = new Date(ty, tm - 1, td);
        const curDayOfWeek = todayDate.getDay();
        const curDiffToMonday = curDayOfWeek === 0 ? -6 : 1 - curDayOfWeek;
        const currentMonday = new Date(todayDate);
        currentMonday.setDate(todayDate.getDate() + curDiffToMonday);
        currentMonday.setHours(0, 0, 0, 0);

        const weekMap = new Map();
        weekMap.set(currentMonday.getTime(), new Date(currentMonday));

        allRecords.forEach(r => {
            if (!r.dateString) return;
            const parts = r.dateString.split('/').map(Number);
            if (parts.length !== 3 || parts.some(isNaN)) return;
            const d = new Date(parts[2], parts[1] - 1, parts[0]);
            const dow = d.getDay();
            const diff = dow === 0 ? -6 : 1 - dow;
            const mon = new Date(d);
            mon.setDate(d.getDate() + diff);
            mon.setHours(0, 0, 0, 0);
            weekMap.set(mon.getTime(), mon);
        });

        const sortedMondayTimes = Array.from(weekMap.keys()).sort((a, b) => b - a);

        const collection = sortedMondayTimes.map(monTime => {
            const monday = weekMap.get(monTime);
            const isCurrentWeek = (monTime === currentMonday.getTime());

            const oneJan = new Date(monday.getFullYear(), 0, 1);
            const numberOfDays = Math.floor((monday - oneJan) / (24 * 60 * 60 * 1000));
            const weekNum = Math.ceil((monday.getDay() + 1 + numberOfDays) / 7);
            const weekId = `${monday.getFullYear()}-W${weekNum}`;

            const plantIndex = Math.abs(weekNum) % PLANTS_CATALOG.length;
            const plant = PLANTS_CATALOG[plantIndex];

            let completedDays = 0;
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const weekRange = `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')} - ${String(sunday.getDate()).padStart(2, '0')}/${String(sunday.getMonth() + 1).padStart(2, '0')}/${monday.getFullYear()}`;

            for (let i = 0; i < 7; i++) {
                const cur = new Date(monday);
                cur.setDate(monday.getDate() + i);
                const normKey = `${cur.getDate()}/${cur.getMonth() + 1}/${cur.getFullYear()}`;
                if ((recordMap.get(normKey) || 0) >= 1500 || recoveredSet.has(normKey)) {
                    completedDays++;
                }
            }

            const isFullyGrown = completedDays >= 4;
            const isMaster = completedDays === 7;
            const STAGE_ICONS = ["🌰", "🌱", "🌿", "🪴", "🌷", "🌺", "💐", plant.icon];
            const stageIcon = completedDays >= 7 ? plant.icon : STAGE_ICONS[completedDays];

            return {
                weekId,
                weekRange,
                weekNum,
                plant,
                completedDays,
                stageIcon,
                isFullyGrown,
                isMaster,
                isCurrentWeek
            };
        });

        res.status(200).json(collection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server đang chạy tại http://localhost:${PORT}`));