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

let currentData = {
    students: [],
    teachers: [DEFAULT_TEACHER],
    timetable: { "8": "TBA", "9": "TBA", "10": "TBA", "11": "TBA", "12": "TBA" },
    notes: [],
    ranks: { "8": [], "9": [], "10": [], "11": [], "12": [] },
    attendanceRecords: []
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
    const merged = { ...currentData, ...snapshotData };

    if (Array.isArray(snapshotData.students)) {
        merged.students = snapshotData.students.map(student => {
            const emailKey = String(student.email || '').trim().toLowerCase();
            const mirrorStudent = (mirror.students || []).find(m => String(m.email || '').trim().toLowerCase() === emailKey);
            return {
                ...student,
                photo: student.photo || mirrorStudent?.photo || student.photo
            };
        });

        (mirror.students || []).forEach(mirrorStudent => {
            const emailKey = String(mirrorStudent.email || '').trim().toLowerCase();
            const exists = merged.students.some(s => String(s.email || '').trim().toLowerCase() === emailKey);
            if (!exists) merged.students.push(mirrorStudent);
        });
    }

    return merged;
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

const saveToCloud = () => {
    console.log("Saving data locally and to Firebase...", currentData);
    persistLocalMirror();

    return set(ref(db, 'ccc_master_data'), currentData)
        .then(() => {
            console.log("Data saved successfully!");
        })
        .catch(err => {
            console.error("Firebase Save Error:", err);
            console.warn("Changes were still saved locally for immediate use.");
            throw err;
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
        alert('Student deleted successfully.');
        window.loadAdminStudents();
    });
};

window.addNewStudent = () => {
    const n = prompt("Name:"), c = prompt("Class:"), e = prompt("Email:"), p = prompt("Phone:");
    if (n && c && e && p) {
        if (!currentData.students) currentData.students = [];
        currentData.students.push({ name: n, class: c, email: e.toLowerCase(), phone: p, fee: { paid: 0, due: 1500 } });
        saveToCloud().then(() => alert("Student Added!"));
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
        alert('Teacher deleted successfully.');
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
        alert('Teacher added successfully.');
        document.getElementById('teacherForm').reset();
        window.loadAdminTeachers();
    });
};

window.loadAdminAttendance = () => {
    const cls = document.getElementById('attClassSelect')?.value;
    const tb = document.getElementById('adminAttendanceList');
    if (!tb || !cls) return;

    const studentsInClass = (currentData.students || [])
        .filter(s => s.class === cls)
        .sort((a, b) => a.name.localeCompare(b.name));

    tb.innerHTML = studentsInClass.map(s => `
        <tr>
            <td>${s.name}</td>
            <td>
                <div class="att-btn-group" data-email="${s.email}">
                    <button class="att-btn present-btn" onclick="window.toggleAttendance(this, 'P')">P</button>
                    <button class="att-btn absent-btn" onclick="window.toggleAttendance(this, 'A')">A</button>
                </div>
            </td>
        </tr>`).join('');
};

window.toggleAttendance = (btn, status) => {
    const group = btn.parentElement;
    group.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    group.dataset.status = status;
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
    persistLocalMirror();
    window.dispatchEvent(new Event('ccc-data-updated'));

    const btn = document.querySelector('#attendanceSection .btn-primary');
    let originalText = '';
    if (btn) {
        originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    saveToCloud()
        .then(() => {
            alert("SUCCESS! Attendance for " + cls + "th (" + topic + ") has been saved.");
            topicEl.value = "";
            window.loadAdminAttendance();
        })
        .catch(() => {
            alert("Attendance saved locally and will sync when connection is available.");
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
    saveToCloud().then(() => alert("Timetable Updated!"));
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
    saveToCloud().then(() => alert("Rankings Saved!"));
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
            alert("Fee Updated!");
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

    // Load Realtime Data
    onValue(ref(db, 'ccc_master_data'), (snapshot) => {
        const val = snapshot.val();
        if (val) {
            currentData = mergeWithLocalMirror(val);
        }

        // Ensure default structures exist
        if (!currentData.students) currentData.students = [];
        if (!currentData.teachers || !Array.isArray(currentData.teachers)) currentData.teachers = [];
        if (currentData.teachers.length === 0) currentData.teachers.push(DEFAULT_TEACHER);
        if (!currentData.timetable) currentData.timetable = { "8": "TBA", "9": "TBA", "10": "TBA", "11": "TBA", "12": "TBA" };
        if (!currentData.notes) currentData.notes = [];
        if (!currentData.ranks) currentData.ranks = { "8": [], "9": [], "10": [], "11": [], "12": [] };
        if (!currentData.attendanceRecords) currentData.attendanceRecords = [];

        if (isLoginPage) handleLoginPage();
        else if (isAdminPage) handleAdminPage();
        else handleStudentDashboard();
    });

    function handleLoginPage() {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const pass = document.getElementById('password').value.trim();
            const user = (currentData.students || []).find(s => {
                const storedEmail = String(s.email || '').trim().toLowerCase();
                const storedPhone = String(s.phone || '').trim();
                return storedEmail === email && storedPhone === pass;
            });

            if (user) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userName', user.name);
                localStorage.setItem('userClass', user.class);
                localStorage.setItem('isAdmin', 'false');
                window.location.href = 'index.html';
            } else {
                alert("Invalid Login!");
            }
        });
    }

    function handleStudentDashboard() {
        const uClass = localStorage.getItem('userClass');
        const uEmail = localStorage.getItem('userEmail');
        document.getElementById('displayUsername').textContent = localStorage.getItem('userName');
        document.getElementById('displayHandle').textContent = `Class ${uClass}th | ${uEmail}`;

        const timetable = currentData.timetable || {};
        if (document.getElementById('studentTimetable'))
            document.getElementById('studentTimetable').innerHTML = `<div class="time-card grade-${uClass}"><div class="class-title">Class ${uClass}th</div><div class="class-time">${timetable[uClass] || 'TBA'}</div></div>`;

        const attBody = document.getElementById('studentAttendanceBody');
        if (attBody) {
            attBody.innerHTML = "";
            (currentData.attendanceRecords || []).forEach(record => {
                const uEmailLower = uEmail.toLowerCase();
                const status = record.data ? (record.data[uEmail] || record.data[uEmailLower]) : null;

                if (status) {
                    attBody.innerHTML += `<tr><td>${record.date}</td><td><span class="status-pill ${status === 'P' ? 'present' : 'absent'}">${status}</span></td><td>${record.topic}</td></tr>`;
                }
            });
        }

        const s = (currentData.students || []).find(x => x.email.toLowerCase() === uEmail);
        if (document.getElementById('studentFeeBody') && s)
            document.getElementById('studentFeeBody').innerHTML = `<tr><td>Paid</td><td>₹${s.fee.paid}</td></tr><tr><td>Due</td><td style="color:red">₹${s.fee.due}</td></tr>`;

        syncStudentPhotoInUI();

        const nList = document.getElementById('studentNotesList');
        if (nList) {
            nList.innerHTML = "";
            (currentData.notes || []).filter(n => n.class === uClass).forEach(n => {
                nList.innerHTML += `<div class="note-item"><span>${n.title}</span><a href="${n.link}" target="_blank" class="download-link"><i class="fas fa-external-link-alt"></i> View/Open</a></div>`;
            });
        }

        const rnk = document.getElementById('studentRankings');
        if (rnk && currentData.ranks && currentData.ranks[uClass]) {
            const data = currentData.ranks[uClass];
            const testName = data.testName || "Class Test";
            const list = data.list || [];
            if (document.getElementById('rankClassLabel')) document.getElementById('rankClassLabel').textContent = testName;

            if (list.length > 0) {
                rnk.innerHTML = `<div class="ranking-card">${list.map((r, i) => `<div class="rank-item"><div class="rank-num">${i + 1}</div><div class="rank-details"><div class="rank-name">${r.name}</div><div class="rank-points">${r.score} marks</div></div></div>`).join('')}</div>`;
            } else {
                rnk.innerHTML = `<p style="color: var(--text-muted); padding: 20px;">No rankings available for ${testName} yet.</p>`;
            }
        }
    }

    function handleAdminPage() {
        window.loadAdminStudents();
        window.loadAdminTeachers();
        window.loadAdminAttendance();
        window.loadAdminTimetable();
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
                currentData.notes.push({ title, class: cls, link });
                // Persist locally first so UI updates immediately
                persistLocalMirror();
                // Save to cloud and refresh UI on completion
                saveToCloud().then(() => {
                    alert("Note Material Added!");
                    e.target.reset();
                    // Notify any listeners (students/admin views) to update
                    window.dispatchEvent(new Event('ccc-data-updated'));
                }).catch(() => {
                    alert('Note saved locally but failed to sync to cloud.');
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
                window.loadAdminAttendance();
                window.loadAdminTimetable();
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
