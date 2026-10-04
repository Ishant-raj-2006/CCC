// Champaran Coaching Center - Firebase Sync Full Version
const firebaseConfig = {
    apiKey: "AIzaSyCTkM0HrrIOb3D1IOp5nLOh7unRLwu1nxw",
    authDomain: "champaran-choching-center.firebaseapp.com",
    databaseURL: "https://champaran-choching-center-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "champaran-choching-center",
    storageBucket: "champaran-choching-center.firebasestorage.app",
    messagingSenderId: "473187056929",
    appId: "1:473187056929:web:c62bdc65d3038a93141260",
    measurementId: "G-SXM6HBBWEX"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


const DEFAULT_TEACHER = {
    name: "Ishant Raj",
    email: "ishant_raj_2006@ccc.com",
    phone: "1234567890",
    username: "Ishant_raj_2006",
    password: "Hello123",
    subject: "Admin",
    role: "Admin"
};

const DEFAULT_STUDENTS = [
    {
        name: "Anup Kumar",
        email: "anupkp631@gmail.com",
        phone: "8318523214",
        class: "10",
        fee: { paid: 0, due: 0 }
    }
];

let currentData = {
    students: DEFAULT_STUDENTS,
    teachers: [DEFAULT_TEACHER],
    timetable: { "8": "TBA", "9": "TBA", "10": "TBA", "11": "TBA", "12": "TBA" },
    notes: [],
    ranks: { "8": [], "9": [], "10": [], "11": [], "12": [] },
    attendanceRecords: [],
    lastUpdatedAt: new Date().toISOString()
};

const STORAGE_MIRROR_KEY = 'ccc_master_data_local';

const persistLocalMirror = () => {
    try {
        localStorage.setItem(STORAGE_MIRROR_KEY, JSON.stringify(currentData));
    } catch (err) {
        console.warn("Local mirror save failed:", err);
    }
};

const loadLocalMirror = () => {
    try {
        const cached = localStorage.getItem(STORAGE_MIRROR_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed) {
                currentData = parsed;
                return parsed;
            }
        }
    } catch (err) {
        console.warn("Local mirror load failed:", err);
    }
    return null;
};

const mergeWithLocalMirror = (snapshotData) => {
    const mirror = loadLocalMirror() || {};
    const timestampIsNewer = mirror.lastUpdatedAt && (!snapshotData.lastUpdatedAt || mirror.lastUpdatedAt > snapshotData.lastUpdatedAt);

    if (timestampIsNewer) {
        console.warn('Local mirror is newer than Firebase snapshot; preserving local pending changes.');
        return mirror;
    }

    // Database snapshot is newer or equal. Update local mirror.
    try {
        localStorage.setItem(STORAGE_MIRROR_KEY, JSON.stringify(snapshotData));
    } catch (err) {
        console.warn("Failed to persist database snapshot to local mirror:", err);
    }
    return snapshotData;
};

const normalizeRanksData = (ranks) => {
    const defaultRanks = { "8": [], "9": [], "10": [], "11": [], "12": [] };
    if (!ranks || typeof ranks !== 'object') return defaultRanks;
    if (Array.isArray(ranks)) {
        const converted = { ...defaultRanks };
        ranks.forEach(item => {
            if (item && item.class) {
                converted[String(item.class)] = {
                    testName: item.testName || "",
                    list: Array.isArray(item.list) ? item.list : []
                };
            }
        });
        return converted;
    }
    const normalized = {};
    Object.keys(defaultRanks).forEach(cls => {
        const value = ranks[cls];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            normalized[cls] = {
                testName: String(value.testName || ""),
                list: Array.isArray(value.list) ? value.list : []
            };
        } else {
            normalized[cls] = { testName: "", list: [] };
        }
    });
    return normalized;
};

const syncStudentPhotoInUI = () => {
    const img = document.getElementById('studentProfileImg');
    if (!img) return;

    const uEmail = localStorage.getItem('userEmail');
    const student = (currentData.students || []).find(x => x.email?.toLowerCase() === uEmail?.toLowerCase());
    img.src = student?.photo || 'student_profile_placeholder_1775973326014.png';
};

window.tryAdminLogin = (username, password) => {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedPassword = String(password || '').trim();

    const matchInList = (list) => {
        if (!Array.isArray(list)) return null;
        return list.find(t => {
            const u = String(t.username || '').trim().toLowerCase();
            const e = String(t.email || '').trim().toLowerCase();
            const p = String(t.password || '').trim();
            return (u === normalizedUsername || e === normalizedUsername) && p === normalizedPassword;
        });
    };

    // Check in-memory data first
    let teacher = matchInList(currentData.teachers || []);
    if (!teacher) {
        // Fallback: check local mirror (helps when realtime Firebase hasn't synced yet)
        try {
            const mirror = loadLocalMirror();
            teacher = matchInList((mirror && mirror.teachers) || []);
        } catch (err) {
            console.warn('Failed reading local mirror for admin login fallback', err);
        }
    }

    if (teacher) {
        window.currentTeacherEmail = teacher.email || '';
        return true;
    }

    return false;
};

const showThankYouMessage = (message = 'Thank you Sir!', duration = 500) => {
    const overlay = document.getElementById('thankYouOverlay');
    const messageEl = document.getElementById('thankYouMessage');
    if (!overlay) return;

    if (messageEl) messageEl.textContent = message;
    overlay.classList.add('visible');

    if (window._thankYouTimeout) clearTimeout(window._thankYouTimeout);
    window._thankYouTimeout = setTimeout(() => {
        overlay.classList.remove('visible');
        window._thankYouTimeout = null;
    }, duration);
};

const saveToCloud = () => {
    currentData.lastUpdatedAt = new Date().toISOString();
    console.log("Saving data locally and to Firebase...", currentData);
    persistLocalMirror();

    // Trigger local update immediately
    window.dispatchEvent(new Event('ccc-data-updated'));

    return new Promise((resolve) => {
        showThankYouMessage('Thank you Sir!', 500);

        set(ref(db, 'ccc_master_data'), currentData)
            .then(() => {
                console.log("Data saved successfully to Firebase!");
                resolve();
            })
            .catch(err => {
                console.error("Firebase Save Error:", err);
                console.warn("Changes saved locally.");
                resolve(); // Resolve anyway so caller's flow continues
            });
    });
};

// Admin Global Functions
window.loadAdminStudents = () => {
    const tb = document.getElementById('adminStudentList');
    const filter = document.getElementById('studentClassFilter')?.value || 'all';
    const students = (currentData.students || []).filter(s => filter === 'all' || s.class === filter);
    if (tb) tb.innerHTML = students.sort((a, b) => a.name.localeCompare(b.name)).map(s => `
        <tr>
            <td>${s.name}</td>
            <td>${s.class}th</td>
            <td>${s.phone}</td>
            <td>P:₹${s.fee.paid}<br>D:₹${s.fee.due}</td>
            <td style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button onclick="openFeeModal('${s.email}','${s.name}')" class="btn btn-outline">Edit Fee</button>
                <button onclick="deleteStudent('${s.email}')" class="btn btn-danger" style="padding: 10px 14px;">Delete</button>
            </td>
        </tr>
    `).join('');
};

window.deleteStudent = (email) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    currentData.students = (currentData.students || []).filter(s => s.email !== email);
    saveToCloud().then(() => {
        window.loadAdminStudents();
    });
};

window.addNewStudent = () => {
    const n = prompt("Name:"), c = prompt("Class:"), e = prompt("Email:"), p = prompt("Phone:");
    if (n && c && e && p) {
        const cleanedClass = c.replace(/\D/g, '') || "10";
        if (!currentData.students) currentData.students = [];
        currentData.students.push({ 
            name: n.trim(), 
            class: cleanedClass, 
            email: e.trim().toLowerCase(), 
            phone: p.trim(), 
            fee: { paid: 0, due: 0 } 
        });
        saveToCloud().then(() => {
            window.loadAdminStudents();
        });
    }
};

window.loadAdminTeachers = () => {
    const tb = document.getElementById('adminTeacherList');
    if (!tb) return;
    tb.innerHTML = (currentData.teachers || []).map(t => `
        <tr>
            <td>${t.name}</td>
            <td>${t.email}</td>
            <td>${t.phone || 'N/A'}</td>
            <td>${t.username || 'N/A'}</td>
            <td>${t.role || 'Teacher'}</td>
            <td>
                <button onclick="deleteTeacher('${t.username || t.email}')" class="btn btn-danger" style="padding: 8px 12px;">Delete</button>
            </td>
        </tr>
    `).join('');
};

window.deleteTeacher = (identifier) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    currentData.teachers = (currentData.teachers || []).filter(t => t.username !== identifier && t.email !== identifier);
    saveToCloud().then(() => {
        window.loadAdminTeachers();
    });
};

window.addNewTeacher = (e) => {
    e.preventDefault();
    const name = document.getElementById('teacherName').value.trim();
    const email = document.getElementById('teacherEmail').value.trim().toLowerCase();
    const phone = document.getElementById('teacherPhone').value.trim();
    const username = document.getElementById('teacherUsername').value.trim().toLowerCase();
    const password = document.getElementById('teacherPassword').value.trim();
    const subject = document.getElementById('teacherSubject').value.trim();
    const roleEl = document.getElementById('teacherRole');
    const role = roleEl ? roleEl.value.trim() : 'Teacher';

    if (!name || !email || !phone || !username || !password) {
        alert('Please enter name, email, phone, username, and password.');
        return;
    }

    if (!currentData.teachers) currentData.teachers = [];
    currentData.teachers.push({ name, email, phone, username, password, subject, role });
    saveToCloud().then(() => {
        document.getElementById('teacherForm').reset();
        window.loadAdminTeachers();
    });
};

window.updateAttendanceCounts = () => {
    const groups = document.querySelectorAll('.att-btn-group');
    let present = 0;
    let absent = 0;
    groups.forEach(group => {
        const status = group.dataset.status;
        if (status === 'P') present++;
        else if (status === 'A') absent++;
    });
    const presEl = document.getElementById('attPresentCount');
    const absEl = document.getElementById('attAbsentCount');
    if (presEl) presEl.textContent = present;
    if (absEl) absEl.textContent = absent;
};

window.loadAdminAttendance = () => {
    const cls = document.getElementById('attClassSelect')?.value;
    const tb = document.getElementById('adminAttendanceList');
    if (!tb || !cls) return;

    const studentsInClass = (currentData.students || [])
        .filter(s => String(s.class) === String(cls))
        .sort((a, b) => a.name.localeCompare(b.name));

    tb.innerHTML = studentsInClass.map(s => `
        <tr>
            <td>${s.name}</td>
            <td>
                <div class="att-btn-group" data-email="${s.email}" data-status="P">
                    <button class="att-btn present-btn selected" onclick="window.toggleAttendance(this, 'P')">P</button>
                    <button class="att-btn absent-btn" onclick="window.toggleAttendance(this, 'A')">A</button>
                </div>
            </td>
        </tr>`).join('');

    window.updateAttendanceCounts();
};

window.toggleAttendance = (btn, status) => {
    const group = btn.parentElement;
    group.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    group.dataset.status = status;
    window.updateAttendanceCounts();
};

window.saveAttendance = () => {
    const classEl = document.getElementById('attClassSelect');
    const topicEl = document.getElementById('attTopicName');

    if (!classEl || !topicEl) {
        alert("System Error: Attendance fields not found in UI.");
        return;
    }

    const cls = classEl.value;
    const topic = topicEl.value.trim();
    const date = new Date().toLocaleDateString();

    if (!topic) {
        alert("Please enter a Topic Name first!");
        topicEl.focus();
        return;
    }

    const statusData = {};
    const groups = document.querySelectorAll('.att-btn-group');

    if (groups.length === 0) {
        alert("Error: No students found in this class to mark attendance!");
        return;
    }

    groups.forEach(group => {
        const email = group.dataset.email;
        const status = group.dataset.status || 'A'; // Auto-Absent
        statusData[email] = status;
    });

    if (!currentData.attendanceRecords) currentData.attendanceRecords = [];
    currentData.attendanceRecords.push({ date, class: cls, topic, data: statusData });

    const btn = document.querySelector('#attendanceSection .btn-primary');
    let originalText = '';
    if (btn) {
        originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    saveToCloud()
        .then(() => {
            topicEl.value = "";
            window.loadAdminAttendance();
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
};

window.loadAdminTimetable = () => {
    const div = document.getElementById('adminTimetableList');
    if (div) div.innerHTML = Object.keys(currentData.timetable).map(cls => `<div class="form-group"><label>Class ${cls}th</label><input type="text" class="tt-in" data-class="${cls}" value="${currentData.timetable[cls]}"></div>`).join('');
};

window.saveTimetable = () => {
    document.querySelectorAll('.tt-in').forEach(i => currentData.timetable[i.dataset.class] = i.value);
    saveToCloud();
};

window.renderAdminNotes = () => {
    const nList = document.getElementById('adminNotesList');
    if (!nList) return;

    const notes = Array.isArray(currentData.notes) ? currentData.notes : [];
    if (notes.length === 0) {
        nList.innerHTML = `<tr><td colspan="4" style="color: var(--text-muted);">No notes uploaded yet.</td></tr>`;
        return;
    }

    nList.innerHTML = notes
        .slice()
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .map(note => `
            <tr>
                <td>${note.title}</td>
                <td>${note.class}th</td>
                <td><a href="${note.link}" target="_blank" class="download-link"><i class="fas fa-external-link-alt"></i> Open</a></td>
                <td><button onclick="window.deleteNote('${note.id}')" class="btn btn-danger" style="padding: 8px 12px;">Delete</button></td>
            </tr>
        `).join('');
};

window.deleteNote = (noteId) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    currentData.notes = (currentData.notes || []).filter(n => n.id !== noteId);
    saveToCloud().then(() => {
        window.renderAdminNotes();
    });
};

window.loadRanksForClass = () => {
    const cls = document.getElementById('rankClassSelect').value;
    const rDiv = document.getElementById('rankInputs');
    if (!rDiv) return;

    // For teacher workflow: always show all students of the selected class
    // with student names prefilled and scores left blank. Also clear Test Name
    // so teacher can enter a new test name and fill scores.
    document.getElementById('rankTestName').value = "";

    rDiv.innerHTML = "";
    const studentsInClass = (currentData.students || [])
        .filter(s => String(s.class) === String(cls))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (studentsInClass.length === 0) {
        // If no students, show a few empty rows for manual entry
        for (let i = 0; i < 3; i++) window.addRankRow();
    } else {
        studentsInClass.forEach(s => window.createRankRow(s.name, ""));
    }
};

window.createRankRow = (name = "", score = "") => {
    const rDiv = document.getElementById('rankInputs');
    const row = document.createElement('div');
    row.className = 'form-row rank-item-row';
    row.innerHTML = `
        <div class="form-group"><input type="text" class="rn-n" placeholder="Student Name" value="${name}"></div>
        <div class="form-group"><input type="number" class="rn-s" placeholder="Score/Points" value="${score}"></div>
        <button onclick="this.parentElement.remove()" class="btn btn-danger" style="width: 40px; height: 40px; padding: 0; margin-top: 10px;"><i class="fas fa-times"></i></button>
    `;
    rDiv.appendChild(row);
};

window.addRankRow = () => window.createRankRow();

window.saveRanks = () => {
    const cls = document.getElementById('rankClassSelect').value;
    const testName = document.getElementById('rankTestName').value.trim();
    const r = [];

    // Collect all rows; teacher may leave some scores blank - treat blank as null
    document.querySelectorAll('.rank-item-row').forEach(row => {
        const name = (row.querySelector('.rn-n')?.value || '').trim();
        const scoreRaw = (row.querySelector('.rn-s')?.value || '').trim();
        const score = scoreRaw === '' ? null : parseFloat(scoreRaw);
        if (name) r.push({ name, score });
    });

    // Sort such that entries with numeric scores come first (desc), then blanks
    r.sort((a, b) => {
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score;
    });

    currentData.ranks[cls] = { testName: testName, list: r };
    saveToCloud();
};

let editEmail = "";
window.openFeeModal = (email, name) => {
    editEmail = email; const s = currentData.students.find(x => x.email === email);
    if (s) {
        document.getElementById('feeStudentName').textContent = name;
        document.getElementById('feePaidInput').value = s.fee.paid;
        document.getElementById('feeDueInput').value = s.fee.due;
        document.getElementById('feeModal').style.display = 'flex';
    }
};
window.closeFeeModal = () => document.getElementById('feeModal').style.display = 'none';

window.confirmFeeUpdate = () => {
    const s = currentData.students.find(x => x.email === editEmail);
    if (s) {
        s.fee.paid = document.getElementById('feePaidInput').value;
        s.fee.due = document.getElementById('feeDueInput').value;
        saveToCloud().then(() => {
            document.getElementById('feeModal').style.display = 'none';
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('admin-login.html');
    const isAdminPage = window.location.pathname.includes('admin.html');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const isAdmin = localStorage.getItem('isAdmin');

    loadLocalMirror();

    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const photoInput = document.getElementById('photoInput');
    changePhotoBtn?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const uEmail = localStorage.getItem('userEmail');
            if (!uEmail) return;

            const student = (currentData.students || []).find(x => x.email?.toLowerCase() === uEmail.toLowerCase());
            if (!student) return;

            student.photo = reader.result;
            persistLocalMirror();
            saveToCloud().catch(() => {});
            syncStudentPhotoInUI();
            alert('Profile photo updated successfully!');
            e.target.value = '';
        };
        reader.readAsDataURL(file);
    });

    if (isAdminPage && (!isLoggedIn || !isAdmin)) {
        window.location.href = 'admin-login.html'; return;
    }
    if (!isLoggedIn && !isLoginPage) {
        window.location.href = 'login.html'; return;
    }

    // Helper to ensure structure defaults
    const ensureStructures = () => {
        if (!currentData) currentData = {};
        if (!currentData.students || !Array.isArray(currentData.students)) currentData.students = [];
        if (currentData.students.length === 0) currentData.students = [...DEFAULT_STUDENTS];
        if (!currentData.teachers || !Array.isArray(currentData.teachers)) currentData.teachers = [];
        if (currentData.teachers.length === 0) currentData.teachers.push(DEFAULT_TEACHER);
        if (!currentData.timetable) currentData.timetable = { "8": "TBA", "9": "TBA", "10": "TBA", "11": "TBA", "12": "TBA" };
        currentData.notes = (Array.isArray(currentData.notes) ? currentData.notes : []).map((note, index) => ({
            id: note.id || `note-${note.class || 'unknown'}-${index}-${Math.random().toString(36).slice(2, 8)}`,
            title: note.title || 'Untitled Note',
            class: note.class || '8',
            link: note.link || '#',
            createdAt: note.createdAt || new Date().toISOString()
        }));
        currentData.ranks = normalizeRanksData(currentData.ranks);
        if (!currentData.attendanceRecords) currentData.attendanceRecords = [];
    };

    // Render immediately from local copy
    ensureStructures();
    if (!isLoginPage) {
        if (isAdminPage) handleAdminPage();
        else handleStudentDashboard();
    } else {
        handleLoginPage();
    }

    // Load Realtime Data
    onValue(ref(db, 'ccc_master_data'), (snapshot) => {
        const val = snapshot.val();
        if (val) {
            currentData = mergeWithLocalMirror(val);
        }

        ensureStructures();

        if (!isLoginPage) {
            if (isAdminPage) handleAdminPage();
            else handleStudentDashboard();
        }
    });

    function handleLoginPage() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const pass = document.getElementById('password').value.trim();
            const cleanPass = pass.replace(/\D/g, '');

            const studentsList = (currentData && Array.isArray(currentData.students) && currentData.students.length > 0)
                ? currentData.students
                : DEFAULT_STUDENTS;

            const user = studentsList.find(s => {
                const storedEmail = String(s.email || '').trim().toLowerCase();
                const storedPhone = String(s.phone || '').trim();
                const cleanStoredPhone = storedPhone.replace(/\D/g, '');

                const emailMatches = storedEmail === email;
                const phoneMatches = (storedPhone === pass) ||
                                     (cleanPass.length > 0 && cleanStoredPhone === cleanPass) ||
                                     (cleanPass.length >= 10 && cleanStoredPhone.endsWith(cleanPass.slice(-10)));
                return emailMatches && phoneMatches;
            });

            if (user) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userName', user.name);
                localStorage.setItem('userClass', user.class);
                localStorage.setItem('isAdmin', 'false');
                window.location.href = 'index.html';
            } else {
                const emailExists = studentsList.some(s => String(s.email || '').trim().toLowerCase() === email);
                if (!emailExists) {
                    alert("The student email '" + email + "' is not registered yet.\n\nPlease ask your Teacher to add your student profile in the Admin Panel.");
                } else {
                    alert("Incorrect Password / Phone Number!\n\nPlease enter the correct 10-digit phone number registered for this email.");
                }
            }
        });
    }

    function handleStudentDashboard() {
        const uEmail = (localStorage.getItem('userEmail') || '').toLowerCase().trim();
        const student = (currentData.students || []).find(x => String(x.email || '').toLowerCase().trim() === uEmail);

        const studentName = student ? student.name : (localStorage.getItem('userName') || 'Student');
        const uClass = student ? String(student.class) : (localStorage.getItem('userClass') || '10');

        const displayUsername = document.getElementById('displayUsername');
        const displayHandle = document.getElementById('displayHandle');

        if (displayUsername) displayUsername.textContent = studentName;
        if (displayHandle) displayHandle.textContent = `Class ${uClass}th | ${uEmail || 'No Email'}`;

        // 1. Timetable
        const timetable = currentData.timetable || {};
        const ttContainer = document.getElementById('studentTimetable');
        if (ttContainer) {
            const classSchedule = timetable[uClass] || 'TBA';
            ttContainer.innerHTML = `
                <div class="time-card grade-${uClass}">
                    <div class="time-card-header">
                        <span class="class-title"><i class="fas fa-graduation-cap"></i> Class ${uClass}th Regular Batch</span>
                        <span class="grade-pill">Grade ${uClass}th</span>
                    </div>
                    <div class="class-time"><i class="fas fa-clock" style="color: var(--primary);"></i> ${classSchedule}</div>
                    <div class="time-card-footer"><i class="fas fa-chalkboard-teacher"></i> Instructor: Ishant Raj Sir</div>
                </div>
            `;
        }

        // 2. Attendance Stats & History
        const attBody = document.getElementById('studentAttendanceBody');
        let totalClasses = 0;
        let presentCount = 0;
        let absentCount = 0;
        let attRowsHTML = '';

        (currentData.attendanceRecords || []).forEach(record => {
            const uEmailLower = uEmail.toLowerCase();
            const statusData = record.data || {};
            const status = statusData[uEmail] || statusData[uEmailLower];

            if (status) {
                totalClasses++;
                if (status === 'P') presentCount++;
                else if (status === 'A') absentCount++;

                attRowsHTML += `
                    <tr>
                        <td><i class="far fa-calendar-alt" style="color: var(--text-muted); margin-right: 4px;"></i> ${record.date || 'N/A'}</td>
                        <td><span class="status-pill ${status === 'P' ? 'present' : 'absent'}">${status === 'P' ? '<i class="fas fa-check"></i> Present' : '<i class="fas fa-times"></i> Absent'}</span></td>
                        <td>${record.topic || 'General Session'}</td>
                    </tr>
                `;
            }
        });

        const rate = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

        const attTotEl = document.getElementById('attTotalClasses');
        const attPresEl = document.getElementById('attPresentClasses');
        const attAbsEl = document.getElementById('attAbsentClasses');
        const attPercEl = document.getElementById('attPercentage');
        const attFillEl = document.getElementById('attProgressFill');

        if (attTotEl) attTotEl.textContent = totalClasses;
        if (attPresEl) attPresEl.textContent = presentCount;
        if (attAbsEl) attAbsEl.textContent = absentCount;
        if (attPercEl) attPercEl.textContent = `${rate}%`;
        if (attFillEl) attFillEl.style.width = `${rate}%`;

        if (attBody) {
            attBody.innerHTML = attRowsHTML || `<tr><td colspan="3" class="empty-state-cell"><i class="fas fa-calendar-minus"></i> No attendance records marked yet.</td></tr>`;
        }

        // 3. Fee Status
        const feeBody = document.getElementById('studentFeeBody');
        const feePill = document.getElementById('feeStatusPill');

        if (feeBody) {
            const paid = parseFloat(student?.fee?.paid || 0);
            const due = parseFloat(student?.fee?.due || 0);
            const total = paid + due;

            let statusText = 'Fully Paid';
            let statusClass = 'status-paid';

            if (due > 0 && paid > 0) {
                statusText = 'Partially Paid';
                statusClass = 'status-partial';
            } else if (due > 0 && paid === 0) {
                statusText = 'Payment Due';
                statusClass = 'status-due';
            } else if (total === 0) {
                statusText = 'No Fee Recorded';
                statusClass = 'status-paid';
            }

            if (feePill) {
                feePill.textContent = statusText;
                feePill.className = `fee-status-pill ${statusClass}`;
            }

            feeBody.innerHTML = `
                <tr>
                    <td>Total Course Fee</td>
                    <td style="text-align: right; font-weight: 600;">₹${total.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Paid Amount</td>
                    <td style="text-align: right; color: var(--accent); font-weight: 700;">₹${paid.toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Balance Due</td>
                    <td style="text-align: right; color: ${due > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 700;">₹${due.toLocaleString()}</td>
                </tr>
            `;
        }

        syncStudentPhotoInUI();

        // 4. Notes List
        const nList = document.getElementById('studentNotesList');
        if (nList) {
            nList.innerHTML = "";
            const filteredNotes = (currentData.notes || []).filter(n => String(n.class) === String(uClass));
            if (filteredNotes.length === 0) {
                nList.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i> No notes uploaded for Class ${uClass}th yet.</div>`;
            } else {
                filteredNotes.forEach(n => {
                    const cleanTitle = (n.title || 'Study Material').replace(/'/g, "\\'");
                    nList.innerHTML += `
                        <div class="note-item">
                            <div class="note-title-info">
                                <i class="fas fa-file-pdf note-icon"></i>
                                <div>
                                    <div class="note-name">${n.title || 'Study Material'}</div>
                                    <div class="note-meta">Class ${n.class}th</div>
                                </div>
                            </div>
                            <div class="note-actions">
                                <a href="${n.link || '#'}" target="_blank" class="download-link" title="Open Document"><i class="fas fa-external-link-alt"></i> Open</a>
                                <button onclick="window.downloadNoteFile('${cleanTitle}')" class="btn btn-outline btn-xs" title="Download Document"><i class="fas fa-download"></i></button>
                            </div>
                        </div>
                    `;
                });
            }
        }

        // 5. Test Rankings
        const rnk = document.getElementById('studentRankings');
        if (rnk) {
            const ranksForClass = (currentData.ranks && currentData.ranks[uClass]) ? currentData.ranks[uClass] : null;
            const testName = ranksForClass?.testName || `Class ${uClass}th Monthly Test`;
            const list = ranksForClass?.list || [];

            if (document.getElementById('rankClassLabel')) {
                document.getElementById('rankClassLabel').textContent = testName;
            }

            if (list.length > 0) {
                rnk.innerHTML = list.map((r, i) => {
                    const isLoggedUser = studentName && String(r.name || '').trim().toLowerCase() === studentName.trim().toLowerCase();
                    const scoreText = r.score !== null && r.score !== undefined ? `${r.score} Marks` : 'Awaiting Marks';
                    return `
                        <div class="rank-item ${isLoggedUser ? 'logged-student-rank' : ''}">
                            <div class="rank-num">${i + 1}</div>
                            <div class="rank-details">
                                <div class="rank-name">
                                    ${r.name}
                                    ${isLoggedUser ? '<span class="you-badge">YOU</span>' : ''}
                                </div>
                                <div class="rank-points">${scoreText}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                rnk.innerHTML = `<div class="empty-state"><i class="fas fa-medal"></i> No test rankings uploaded for Class ${uClass}th yet.</div>`;
            }
        }
    }

    function handleAdminPage() {
        window.loadAdminStudents();
        window.loadAdminTeachers();
        window.loadAdminAttendance();
        window.loadAdminTimetable();
        window.renderAdminNotes();
        window.loadRanksForClass();

        const noteForm = document.getElementById('uploadNoteForm');
        if (noteForm && !noteForm.hasListener) {
            noteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = (document.getElementById('noteTitle').value || '').trim();
                const cls = (document.getElementById('noteClass').value || '').trim();
                const link = (document.getElementById('noteLink').value || '').trim() || "#";
                if (!title || !cls) { alert('Please enter note title and select class.'); return; }

                if (!currentData.notes) currentData.notes = [];
                const noteId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                currentData.notes.push({ id: noteId, title, class: cls, link, createdAt: new Date().toISOString() });
                saveToCloud().then(() => {
                    e.target.reset();
                    window.renderAdminNotes();
                });
            });
            noteForm.hasListener = true;
        }
    }

    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_MIRROR_KEY && event.newValue) {
            try {
                currentData = JSON.parse(event.newValue);
            } catch (err) {
                console.warn('Could not parse mirrored data:', err);
            }

            if (isAdminPage) {
                window.loadAdminStudents();
                window.loadAdminTeachers();
                window.loadAdminAttendance();
                window.loadAdminTimetable();
                window.renderAdminNotes();
                window.loadRanksForClass();
            } else if (!isLoginPage) {
                handleStudentDashboard();
            }
        }
    });

    window.addEventListener('ccc-data-updated', () => {
        if (isAdminPage) {
            window.loadAdminStudents();
            window.loadAdminAttendance();
            window.loadAdminTimetable();
            window.renderAdminNotes();
            window.loadRanksForClass();
        } else if (!isLoginPage) {
            handleStudentDashboard();
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });
});


window.togglePasswordVisibility = (id, icon) => {
    const i = document.getElementById(id);
    if (i) {
        i.type = i.type === "password" ? "text" : "password";
        icon.classList.toggle('fa-eye'); icon.classList.toggle('fa-eye-slash');
    }
};
window.downloadNoteFile = (name) => {
    const blob = new Blob([`Material: ${name}\nCCC Coaching`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name}.txt`;
    a.click();
};
