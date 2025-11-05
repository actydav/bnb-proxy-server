// ===== PANEL DE ADMINISTRACIÓN =====

let adminChart = null;

async function abrirModalAdmin() {
    document.getElementById('admin-modal').style.display = 'block';
    await filtrarEstudiantesPorGradoYParalelo();
    actualizarDropdownConceptos();
    actualizarDropdownEgresos();
    abrirPestana('cursos');
}

function cerrarModalAdmin() {
    document.getElementById('admin-modal').style.display = 'none';
}

function abrirPestana(nombrePestana) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`${nombrePestana}-tab`).classList.add('active');
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

async function filtrarEstudiantesPorGradoYParalelo() {
    const grado = document.getElementById('admin-grade').value;
    const paralelo = document.getElementById('admin-parallel').value;

    students = await firebaseServices.students.filterStudents(grado, paralelo);
    actualizarListaEstudiantes();
    actualizarEstadisticas();
}

function actualizarListaEstudiantes() {
    const lista = document.getElementById('student-list');
    lista.innerHTML = '';

    if (students.length === 0) {
        lista.innerHTML = '<p class="text-gray-600">No hay estudiantes.</p>';
        return;
    }

    students.forEach(estudiante => {
        const div = document.createElement('div');
        div.className = 'p-2 border-b cursor-pointer hover:bg-red-50';
        div.innerText = `${estudiante.lastNamePaternal} ${estudiante.lastNameMaternal} ${estudiante.firstName}`;
        div.onclick = () => mostrarDetallesEstudiante(estudiante.id);
        lista.appendChild(div);
    });
}

async function actualizarEstadisticas() {
    document.getElementById('total-students').innerText = students.length;

    const ingresosTotales = students.reduce((suma, est) => {
        return suma + concepts.reduce((p, c) => p + (est.payments?.[c]?.total || 0), 0);
    }, 0);
    document.getElementById('total-income').innerText = `Bs ${ingresosTotales.toFixed(2)}`;

    const pendiente = students.reduce((suma, est) => {
        const egresos = expenses.reduce((e, ex) => e + (est.expenses?.[ex]?.total || 0), 0);
        const pagado = concepts.reduce((p, c) => p + (est.payments?.[c]?.total || 0), 0);
        let mensualidad = 0;

        if (est.familyGroup) {
            const familia = students.filter(s => s.familyGroup === est.familyGroup);
            const pagadorPrincipal = familia.find(s => s.isPrimaryPayer);
            if (pagadorPrincipal?.ci === est.ci) {
                mensualidad = monthlyFee;
            }
        } else {
            mensualidad = monthlyFee;
        }

        return suma + Math.max(0, mensualidad + egresos - pagado);
    }, 0);

    document.getElementById('pending-amount').innerText = `Bs ${pendiente.toFixed(2)}`;

    const alDia = students.filter(est => {
        if (est.familyGroup) {
            const familia = students.filter(s => s.familyGroup === est.familyGroup);
            const pagadorPrincipal = familia.find(s => s.isPrimaryPayer);
            return (pagadorPrincipal?.payments?.['Mensualidad']?.total || 0) >= monthlyFee;
        } else {
            return (est.payments?.['Mensualidad']?.total || 0) >= monthlyFee;
        }
    }).length;

    document.getElementById('up-to-date').innerText = alDia;
}

async function mostrarDetallesEstudiante(idEstudiante) {
    const estudiante = students.find(s => s.id === idEstudiante);
    if (!estudiante) return;

    const detalles = document.getElementById('student-details');
    const familia = estudiante.familyGroup
        ? students.filter(s => s.familyGroup === estudiante.familyGroup)
        : [estudiante];

    let html = `
        <h3 class="text-xl font-semibold fya-red-text">${estudiante.lastNamePaternal} ${estudiante.lastNameMaternal} ${estudiante.firstName}</h3>
        <p><strong>CI:</strong> ${estudiante.ci}</p>
        <p><strong>Grado:</strong> ${estudiante.grade} ${estudiante.parallel}</p>
    `;

    if (estudiante.familyGroup) {
        const hermanos = familia.filter(s => s.ci !== estudiante.ci);
        hermanos.forEach(h => {
            html += `<p class="text-sm text-orange-700"><strong>Hermano:</strong> ${h.lastNamePaternal} ${h.lastNameMaternal} ${h.firstName} (CI: ${h.ci})</p>`;
        });
    }

    html += `<h4 class="font-medium mt-4 fya-red-text">Ingresos:</h4>`;
    concepts.forEach(c => {
        if (c === 'Mensualidad') {
            const pagosFamilia = familia.map(s => ({
                nombre: `${s.lastNamePaternal} ${s.lastNameMaternal} ${s.firstName}`,
                ci: s.ci,
                pagado: s.payments?.[c]?.total || 0
            })).filter(p => p.pagado > 0);

            html += `
                <div class="mb-4 p-3 border rounded bg-gray-50">
                    <h5 class="font-medium fya-red-text">${c} (Total: ${estudiante.payments?.[c]?.total || 0} Bs)</h5>
                    ${pagosFamilia.length > 0 ? `
                        <p class="text-sm"><strong>Pagado por:</strong></p>
                        <ul class="pl-5 text-sm list-disc">
                            ${pagosFamilia.map(p => `<li>${p.nombre} ${p.ci === estudiante.ci ? '(tú)' : '(hermano)'} - ${p.pagado} Bs</li>`).join('')}
                        </ul>
                    ` : '<p class="text-sm text-gray-500">Sin pagos</p>'}
                </div>
            `;
        } else {
            html += `<p><strong>${c}:</strong> ${estudiante.payments?.[c]?.total || 0} Bs</p>`;
        }
    });

    detalles.innerHTML = html;
}

// Enlazar hermanos
async function enlazarHermanos() {
    const ci1 = prompt("C.I. del primer estudiante:");
    const ci2 = prompt("C.I. del segundo estudiante:");

    if (!ci1 || !ci2 || ci1 === ci2) {
        alert("CI inválidos.");
        return;
    }

    const todos = await firebaseServices.students.getStudents();
    const e1 = todos.find(s => s.ci === ci1);
    const e2 = todos.find(s => s.ci === ci2);

    if (!e1 || !e2) {
        alert("Estudiante no encontrado.");
        return;
    }

    const grupoId = e1.familyGroup || e2.familyGroup || Date.now().toString();
    e1.familyGroup = grupoId;
    e2.familyGroup = grupoId;

    const principal = todos.find(s => s.familyGroup === grupoId && s.isPrimaryPayer);
    if (!principal) e1.isPrimaryPayer = true;
    e2.isPrimaryPayer = false;

    await firebaseServices.students.saveStudent(e1);
    await firebaseServices.students.saveStudent(e2);

    alert("¡Hermanos enlazados! Solo uno paga la mensualidad.");
    await filtrarEstudiantesPorGradoYParalelo();
}

// Conceptos y egresos
function actualizarDropdownConceptos() {
    const select = document.getElementById('delete-concept');
    select.innerHTML = '<option value="">Seleccione</option>';
    concepts.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.text = c;
        select.appendChild(opt);
    });
}

function actualizarDropdownEgresos() {
    const select = document.getElementById('delete-expense');
    select.innerHTML = '<option value="">Seleccione</option>';
    expenses.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e;
        opt.text = e;
        select.appendChild(opt);
    });
}

async function agregarConcepto() {
    const c = document.getElementById('new-concept').value.trim();
    if (!c || concepts.includes(c)) {
        alert('Concepto inválido o ya existe');
        return;
    }

    concepts.push(c);
    const resultado = await firebaseServices.config.updateConcepts(concepts);
    if (resultado.success) {
        alert('Concepto añadido');
        document.getElementById('new-concept').value = '';
        actualizarDropdownConceptos();
        await inicializarPagosNuevos(c);
    } else {
        alert('Error: ' + resultado.error);
        concepts.pop();
    }
}

async function inicializarPagosNuevos(concepto) {
    const todos = await firebaseServices.students.getStudents();
    for (const est of todos) {
        if (!est.payments) est.payments = {};
        if (!est.payments[concepto]) {
            est.payments[concepto] = { payments: [], total: 0 };
            await firebaseServices.students.saveStudent(est);
        }
    }
}

async function eliminarConcepto() {
    const c = document.getElementById('delete-concept').value;
    if (!c || !confirm(`¿Eliminar "${c}"?`)) return;

    concepts = concepts.filter(x => x !== c);
    const resultado = await firebaseServices.config.updateConcepts(concepts);
    if (resultado.success) {
        actualizarDropdownConceptos();
        alert('Concepto eliminado');
    } else {
        alert('Error: ' + resultado.error);
        concepts.push(c);
    }
}

async function agregarEgreso() {
    const e = document.getElementById('new-expense').value.trim();
    if (!e || expenses.includes(e)) {
        alert('Egreso inválido o ya existe');
        return;
    }

    expenses.push(e);
    const resultado = await firebaseServices.config.updateExpenses(expenses);
    if (resultado.success) {
        alert('Egreso añadido');
        document.getElementById('new-expense').value = '';
        actualizarDropdownEgresos();
    } else {
        alert('Error: ' + resultado.error);
        expenses.pop();
    }
}

async function eliminarEgreso() {
    const e = document.getElementById('delete-expense').value;
    if (!e || !confirm(`¿Eliminar "${e}"?`)) return;

    expenses = expenses.filter(x => x !== e);
    const resultado = await firebaseServices.config.updateExpenses(expenses);
    if (resultado.success) {
        actualizarDropdownEgresos();
        alert('Egreso eliminado');
    } else {
        alert('Error: ' + resultado.error);
        expenses.push(e);
    }
}