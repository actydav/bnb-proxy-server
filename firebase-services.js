// ===== servs. firebase =====
const firebaseServices = {
    // autenticación
    auth: {
        async registerUser(userData, password) {
            try {
                console.log('👤 Registrando nuevo usuario:', { 
                    ci: userData.ci, 
                    email: userData.ci + '@fya.edu.bo',
                    password: password ? '***' : 'empty' 
                });

                // que la contraseña no esté vacía
                if (!password || password.trim() === '') {
                    throw new Error('La contraseña no puede estar vacía');
                }

                // 1. crear usuario en authentication
                const userCredential = await auth.createUserWithEmailAndPassword(
                    userData.ci + '@fya.edu.bo',
                    password
                );
                
                const uid = userCredential.user.uid;
                console.log('Usuario creado en Authentication, UID:', uid);

                // 2. crear documento en users collection
                await db.collection('users').doc(uid).set({
                    ci: userData.ci,
                    firstName: userData.firstName,
                    lastNamePaternal: userData.lastNamePaternal,
                    lastNameMaternal: userData.lastNameMaternal,
                    name: userData.name,
                    grade: userData.grade,
                    parallel: userData.parallel,
                    type: 'parent',
                    familyGroup: userData.familyGroup,
                    isPrimaryPayer: userData.isPrimaryPayer,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log('Documento creado en users collection');

                // 3. crear estudiante en students collection
                const studentRef = await db.collection('students').add({
                    ...userData,
                    userId: uid, // relacionar con el usuario
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log('Estudiante creado en students collection, ID:', studentRef.id);

                return { 
                    success: true, 
                    user: userCredential.user,
                    studentId: studentRef.id 
                };
            } catch (error) {
                console.error('Error en registro:', error);
                
                // mensajes de error más amigables
                let errorMessage = error.message;
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'Este CI ya está registrado';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'La contraseña es muy débil';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'CI inválido';
                }
                
                return { 
                    success: false, 
                    error: errorMessage 
                };
            }
        },

        async loginUser(ci, password, userType) {
            try {
                console.log(' Intentando login con:', { ci, password, userType });
                
                // 1. intentar con el email formateado
                const userCredential = await auth.signInWithEmailAndPassword(
                    ci + '@fya.edu.bo',
                    password
                );
                
                const uid = userCredential.user.uid;
                console.log('Auth exitoso, UID:', uid);
                
                // 2. buscar usuario en Firestore por UID
                let userDoc = await db.collection('users').doc(uid).get();
                
                // 3. si no existe por UID, buscar por CI (fallback)
                if (!userDoc.exists) {
                    console.log(' No encontrado por UID, buscando por CI...');
                    const querySnapshot = await db.collection('users')
                        .where('ci', '==', ci)
                        .limit(1)
                        .get();
                    
                    if (!querySnapshot.empty) {
                        userDoc = querySnapshot.docs[0];
                        console.log('Encontrado por CI');
                    } else {
                        // 4. si tampoco existe por CI, buscar en el documento 'admin'
                        const adminDoc = await db.collection('users').doc('admin').get();
                        if (adminDoc.exists && adminDoc.data().ci === ci) {
                            userDoc = adminDoc;
                            console.log('Encontrado en documento admin');
                        } else {
                            await auth.signOut();
                            return { success: false, error: 'Usuario no encontrado en la base de datos' };
                        }
                    }
                }
                
                const userData = userDoc.data();
                console.log('Datos del usuario:', userData);
                
                // 5. verificar tipo de usuario
                if (userData.type !== userType) {
                    await auth.signOut();
                    return { success: false, error: 'Tipo de usuario incorrecto' };
                }

                return { 
                    success: true, 
                    user: { ...userData, uid: userDoc.id } 
                };
                
            } catch (error) {
                console.error('Error en login:', error);
                return { success: false, error: error.message };
            }
        },

        async logout() {
            await auth.signOut();
        },

        onAuthStateChanged(callback) {
            return auth.onAuthStateChanged(callback);
        },

        async getUserData(uid) {
            const doc = await db.collection('users').doc(uid).get();
            return doc.data();
        }
    },

    // servicio de estudiantes
    students: {
        async getStudents() {
            try {
                const snapshot = await db.collection('students').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Error obteniendo estudiantes:', error);
                return [];
            }
        },

        async getStudentByCI(ci) {
            try {
                const snapshot = await db.collection('students')
                    .where('ci', '==', ci)
                    .limit(1)
                    .get();
                
                if (snapshot.empty) return null;
                
                const doc = snapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            } catch (error) {
                console.error('Error obteniendo estudiante:', error);
                return null;
            }
        },

        async saveStudent(studentData) {
            try {
                if (studentData.id) {
                    await db.collection('students').doc(studentData.id).update({
                        ...studentData,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return { success: true, id: studentData.id };
                } else {
                    const docRef = await db.collection('students').add({
                        ...studentData,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return { success: true, id: docRef.id };
                }
            } catch (error) {
                console.error('Error guardando estudiante:', error);
                return { success: false, error: error.message };
            }
        },

        async deleteStudent(studentId) {
            try {
                await db.collection('students').doc(studentId).delete();
                return { success: true };
            } catch (error) {
                console.error('Error eliminando estudiante:', error);
                return { success: false, error: error.message };
            }
        },

        async filterStudents(grade, parallel) {
            try {
                let query = db.collection('students');
                
                if (grade) query = query.where('grade', '==', grade);
                if (parallel) query = query.where('parallel', '==', parallel);
                
                const snapshot = await query.get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Error filtrando estudiantes:', error);
                return [];
            }
        },

        async searchStudents(query) {
            try {
                const ciSnapshot = await db.collection('students')
                    .where('ci', '>=', query)
                    .where('ci', '<=', query + '\uf8ff')
                    .get();

                const nameSnapshot = await db.collection('students')
                    .where('name', '>=', query)
                    .where('name', '<=', query + '\uf8ff')
                    .get();

                const allDocs = [...ciSnapshot.docs, ...nameSnapshot.docs];
                const uniqueDocs = allDocs.filter((doc, index, self) => 
                    index === self.findIndex(d => d.id === doc.id)
                );

                return uniqueDocs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Error buscando estudiantes:', error);
                return [];
            }
        }
    },

    // pagos
    payments: {
        async addPayment(studentId, concept, paymentData) {
            try {
                const studentRef = db.collection('students').doc(studentId);
                
                await db.runTransaction(async (transaction) => {
                    const studentDoc = await transaction.get(studentRef);
                    if (!studentDoc.exists) throw new Error('Estudiante no encontrado');
                    
                    const student = studentDoc.data();
                    const payments = student.payments || {};
                    const conceptPayments = payments[concept] || { payments: [], total: 0 };
                    
                    conceptPayments.payments.push({
                        date: paymentData.date,
                        amount: paymentData.amount,
                        method: paymentData.method || 'manual',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    conceptPayments.total += paymentData.amount;
                    payments[concept] = conceptPayments;
                    
                    transaction.update(studentRef, { 
                        payments,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                
                return { success: true };
            } catch (error) {
                console.error('Error registrando pago:', error);
                return { success: false, error: error.message };
            }
        },

        async getPaymentHistory(studentId) {
            try {
                const studentDoc = await db.collection('students').doc(studentId).get();
                if (!studentDoc.exists) return {};
                
                return studentDoc.data().payments || {};
            } catch (error) {
                console.error('Error obteniendo historial:', error);
                return {};
            }
        }
    },

    // config.
    config: {
        async getConfig() {
            try {
                const configDoc = await db.collection('config').doc('global').get();
                return configDoc.exists ? configDoc.data() : { concepts: ['Mensualidad'], expenses: [] };
            } catch (error) {
                console.error('Error obteniendo configuración:', error);
                return { concepts: ['Mensualidad'], expenses: [] };
            }
        },

        async updateConcepts(concepts) {
            try {
                await db.collection('config').doc('global').set({
                    concepts,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                return { success: true };
            } catch (error) {
                console.error('Error actualizando conceptos:', error);
                return { success: false, error: error.message };
            }
        },

        async updateExpenses(expenses) {
            try {
                await db.collection('config').doc('global').set({
                    expenses,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                return { success: true };
            } catch (error) {
                console.error('Error actualizando gastos:', error);
                return { success: false, error: error.message };
            }
        }
    }
};