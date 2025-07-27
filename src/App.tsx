import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
} from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

// html2canvas se carga desde CDN en el HTML, por lo que estará disponible globalmente.
// No necesitamos importarlo ni declararlo aquí.

// Tu objeto firebaseConfig REAL, incrustado directamente.
const firebaseConfig = {
  apiKey: "AIzaSyB4rTzW3MGESNv4X3H2b6GVOHuDqWUamQo",
  authDomain: "my-app-de-gestion.firebaseapp.com",
  projectId: "my-app-de-gestion",
  storageBucket: "my-app-de-gestion.firebasestorage.app",
  messagingSenderId: "101570572985",
  appId: "1:101570572985:web:8d6638673a66b7c990a168",
  measurementId: "G-PJK4XV72WG",
};

// Inicialización global de Firebase (fuera de cualquier componente o useEffect)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Contexto para Firebase y autenticación
const FirebaseContext = createContext(null);

// Componente principal de la aplicación
const App = () => {
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentPage, setCurrentPage] = useState("projectList"); // 'projectList' o 'projectView'
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Estados para el modal de interacción personalizado (alerta/confirmación)
  const [showCustomInteractionModal, setShowCustomInteractionModal] =
    useState(false);
  const [customInteractionMessage, setCustomInteractionMessage] = useState("");
  const [customInteractionOnClose, setCustomInteractionOnClose] = useState(
    () => () => setShowCustomInteractionModal(false)
  );
  const [customInteractionOnConfirm, setCustomInteractionOnConfirm] =
    useState(null);
  const [customInteractionShowCancel, setCustomInteractionShowCancel] =
    useState(false);

  // Función para mostrar una alerta personalizada
  const showAlert = (
    message,
    onClose = () => setShowCustomInteractionModal(false)
  ) => {
    setCustomInteractionMessage(message);
    setCustomInteractionOnClose(() => onClose);
    setCustomInteractionOnConfirm(null); // No es una confirmación
    setCustomInteractionShowCancel(false);
    setShowCustomInteractionModal(true);
  };

  // Función para mostrar una confirmación personalizada
  const showConfirm = (
    message,
    onConfirm,
    onCancel = () => setShowCustomInteractionModal(false)
  ) => {
    setCustomInteractionMessage(message);
    setCustomInteractionOnConfirm(() => onConfirm);
    setCustomInteractionOnClose(() => onCancel);
    setCustomInteractionShowCancel(true);
    setShowCustomInteractionModal(true);
  };

  // Manejo del estado de autenticación (dentro del componente)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Si no hay usuario, inicia sesión de forma anónima por defecto.
        await signInAnonymously(auth);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe(); // Limpiar el listener al desmontar
  }, []); // Dependencia vacía para que se ejecute solo una vez al montar

  // Función para navegar a la vista de un proyecto específico
  const goToProjectView = (projectId) => {
    setSelectedProjectId(projectId);
    setCurrentPage("projectView");
  };

  // Función para navegar de vuelta a la lista de proyectos
  const goToProjectList = () => {
    setSelectedProjectId(null);
    setCurrentPage("projectList");
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Cargando aplicación...
        </div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider
      value={{ db, auth, userId, isAuthReady, showAlert, showConfirm }}
    >
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter">
        {currentPage === "projectList" ? (
          <ProjectList goToProjectView={goToProjectView} />
        ) : (
          <ProjectView
            projectId={selectedProjectId}
            goToProjectList={goToProjectList}
          />
        )}
      </div>

      {/* Modal de Interacción Personalizado (Alerta/Confirmación) */}
      {showCustomInteractionModal && (
        <CustomInteractionModal
          message={customInteractionMessage}
          onClose={customInteractionOnClose}
          onConfirm={customInteractionOnConfirm}
          showCancel={customInteractionShowCancel}
        />
      )}
    </FirebaseContext.Provider>
  );
};

// Componente para la lista de proyectos
const ProjectList = ({ goToProjectView }) => {
  const { db, userId, isAuthReady, showAlert } = useContext(FirebaseContext);
  const [projects, setProjects] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinCodeModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Obtener el projectId de la configuración de Firebase (ahora global)
  const projectId = firebaseConfig.projectId || "TU_PROJECT_ID_REAL_AQUI"; // Fallback por si acaso

  useEffect(() => {
    if (!db || !isAuthReady || !userId) return;

    // Listener para los proyectos del usuario (propios y compartidos)
    // La ruta de la colección ahora usa el projectId global
    const q = query(
      collection(db, `artifacts/${projectId}/public/data/projects`),
      where("members", "array-contains", userId)
    );
    const unsubscribeProjects = onSnapshot(
      q,
      (snapshot) => {
        const projectsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProjects(projectsData);
      },
      (error) => {
        console.error("Error fetching projects:", error);
        setErrorMessage("Error al cargar proyectos.");
      }
    );

    // No hay listener para userSettingsRef ni isUnlimited, ya que la app es gratuita

    return () => {
      unsubscribeProjects();
    };
  }, [db, userId, isAuthReady, projectId]); // Añadido projectId a las dependencias

  // Crear un nuevo proyecto
  const createProject = async () => {
    if (!newProjectName.trim()) {
      setErrorMessage("El nombre del proyecto no puede estar vacío.");
      return;
    }

    // Lógica de pago eliminada: los proyectos ahora son ilimitados por defecto

    try {
      // La ruta de la colección ahora usa el projectId global
      const projectsCollectionRef = collection(
        db,
        `artifacts/${projectId}/public/data/projects`
      );
      const newProjectRef = await addDoc(projectsCollectionRef, {
        name: newProjectName,
        ownerId: userId,
        sharedCode: generateShareCode(),
        members: [userId], // El creador es automáticamente miembro
        // isPaid: isUnlimited, // Eliminado: ya no hay planes de pago
        createdAt: new Date(),
      });
      console.log("Proyecto creado con ID:", newProjectRef.id);
      setNewProjectName("");
      setErrorMessage("");
      setShowCreateModal(false);
      goToProjectView(newProjectRef.id); // Ir directamente al proyecto creado
    } catch (error) {
      console.error("Error creating project:", error);
      setErrorMessage("Error al crear el proyecto.");
    }
  };

  // Unirse a un proyecto existente
  const joinProject = async () => {
    if (!joinCode.trim()) {
      setErrorMessage("El código no puede estar vacío.");
      return;
    }
    try {
      // La ruta de la colección ahora usa el projectId global
      const projectsCollectionRef = collection(
        db,
        `artifacts/${projectId}/public/data/projects`
      );
      const q = query(
        projectsCollectionRef,
        where("sharedCode", "==", joinCode)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const projectDoc = querySnapshot.docs[0];
        const projectIdToJoin = projectDoc.id;
        const projectData = projectDoc.data();

        // Evitar unirse si ya es miembro
        if (projectData.members.includes(userId)) {
          setErrorMessage("Ya eres miembro de este proyecto.");
          goToProjectView(projectIdToJoin);
          return;
        }

        // Añadir al usuario como miembro
        // La ruta del documento ahora usa el projectId global
        await updateDoc(
          doc(
            db,
            `artifacts/${projectId}/public/data/projects`,
            projectIdToJoin
          ),
          {
            members: [...projectData.members, userId],
          }
        );
        console.log("Unido al proyecto:", projectIdToJoin);
        setJoinCode("");
        setErrorMessage("");
        setShowJoinCodeModal(false);
        goToProjectView(projectIdToJoin); // Ir directamente al proyecto unido
      } else {
        setErrorMessage("Código de proyecto inválido.");
      }
    } catch (error) {
      console.error("Error joining project:", error);
      setErrorMessage("Error al unirse al proyecto.");
    }
  };

  // Generar un código de 6 caracteres alfanuméricos
  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // handleUpgradeSuccess y PaymentModal eliminados

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-600 dark:text-blue-400">
        Mis Proyectos
      </h1>

      <div className="mb-8 flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
        >
          Crear Nuevo Proyecto
        </button>
        <button
          onClick={() => setShowJoinCodeModal(true)}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
        >
          Unirse a un Proyecto
        </button>
      </div>

      {errorMessage && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4"
          role="alert"
        >
          <span className="block sm:inline">{errorMessage}</span>
          <span
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setErrorMessage("")}
          >
            <svg
              className="fill-current h-6 w-6 text-red-500"
              role="button"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <title>Close</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
            </svg>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <p className="col-span-full text-center text-gray-600 dark:text-gray-400">
            No tienes proyectos. ¡Crea uno o únete a uno!
          </p>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow duration-300 ease-in-out border border-gray-200 dark:border-gray-700"
              onClick={() => goToProjectView(project.id)}
            >
              <h3 className="text-2xl font-semibold mb-2 text-blue-700 dark:text-blue-300">
                {project.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Creado por:{" "}
                {project.ownerId === userId
                  ? "Tú"
                  : project.ownerId.substring(0, 8) + "..."}
              </p>
              {project.sharedCode && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Código:{" "}
                  <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-md">
                    {project.sharedCode}
                  </span>
                </p>
              )}
              {/* Eliminado: ya no hay indicación de proyecto "pagado" */}
            </div>
          ))
        )}
      </div>

      {/* Modal para Crear Proyecto */}
      {showCreateModal && (
        <Modal
          title="Crear Nuevo Proyecto"
          onClose={() => setShowCreateModal(false)}
        >
          <input
            type="text"
            id="newProjectNameInput"
            className="w-full p-3 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nombre del proyecto"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button
            onClick={createProject}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Crear
          </button>
        </Modal>
      )}

      {/* Modal para Unirse a Proyecto */}
      {showJoinModal && (
        <Modal
          title="Unirse a un Proyecto"
          onClose={() => setShowJoinCodeModal(false)}
        >
          <input
            type="text"
            id="joinCodeInput"
            className="w-full p-3 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Código del proyecto"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button
            onClick={joinProject}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Unirse
          </button>
        </Modal>
      )}

      {/* Modal de Pago/Actualización eliminado */}
    </div>
  );
};

// Componente para la vista de un proyecto (Gantt y Kanban)
const ProjectView = ({ projectId, goToProjectList }) => {
  const { db, userId, isAuthReady, showConfirm } = useContext(FirebaseContext);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // Para editar tareas existentes
  const [activeTab, setActiveTab] = useState("kanban"); // 'kanban' o 'gantt'
  const [showShareModal, setShowShareModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Ref para el componente GanttChart para la exportación
  const ganttChartRef = useRef(null);

  // Obtener el projectId de la configuración de Firebase (ahora global)
  const realProjectId = firebaseConfig.projectId || "TU_PROJECT_ID_REAL_AQUI"; // Fallback por si acaso

  useEffect(() => {
    if (!db || !isAuthReady || !projectId) return;

    // Listener para el proyecto actual
    // La ruta de la colección ahora usa el projectId global
    const projectDocRef = doc(
      db,
      `artifacts/${realProjectId}/public/data/projects`,
      projectId
    );
    const unsubscribeProject = onSnapshot(
      projectDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProject({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.log("No such project!");
          goToProjectList(); // Si el proyecto no existe, vuelve a la lista
        }
      },
      (error) => {
        console.error("Error fetching project:", error);
        setErrorMessage("Error al cargar los detalles del proyecto.");
      }
    );

    // Listener para las tareas del proyecto
    // La ruta de la colección ahora usa el projectId global
    const tasksCollectionRef = collection(
      db,
      `artifacts/${realProjectId}/public/data/projects/${projectId}/tasks`
    );
    const unsubscribeTasks = onSnapshot(
      tasksCollectionRef,
      (snapshot) => {
        const tasksData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Ordenar por fase (si existe) y luego por fecha de inicio
        setTasks(
          tasksData.sort((a, b) => {
            const phaseA = a.phase || "ZZZ"; // Default to ZZZ to put general tasks last
            const phaseB = b.phase || "ZZZ";
            if (phaseA < phaseB) return -1;
            if (phaseA > phaseB) return 1;
            return new Date(a.startDate) - new Date(b.startDate);
          })
        );
      },
      (error) => {
        console.error("Error fetching tasks:", error);
        setErrorMessage("Error al cargar las tareas.");
      }
    );

    return () => {
      unsubscribeProject();
      unsubscribeTasks();
    };
  }, [db, projectId, isAuthReady, goToProjectList, realProjectId]); // Añadido realProjectId a las dependencias

  // Añadir o actualizar tarea
  const saveTask = async (taskData) => {
    try {
      // La ruta de la colección ahora usa el projectId global
      const tasksCollectionRef = collection(
        db,
        `artifacts/${realProjectId}/public/data/projects/${projectId}/tasks`
      );
      if (editingTask) {
        await updateDoc(doc(tasksCollectionRef, editingTask.id), taskData);
        console.log("Tarea actualizada:", editingTask.id);
      } else {
        await addDoc(tasksCollectionRef, taskData);
        console.log("Tarea añadida.");
      }
      setShowTaskModal(false);
      setEditingTask(null);
      setErrorMessage("");
    } catch (error) {
      console.error("Error saving task:", error);
      setErrorMessage("Error al guardar la tarea.");
    }
  };

  // Eliminar tarea usando el modal de confirmación personalizado
  const deleteTask = (taskId) => {
    showConfirm(
      "¿Estás seguro de que quieres eliminar esta tarea?",
      async () => {
        // Callback de confirmación
        try {
          // La ruta del documento ahora usa el projectId global
          await deleteDoc(
            doc(
              db,
              `artifacts/${realProjectId}/public/data/projects/${projectId}/tasks`,
              taskId
            )
          );
          console.log("Tarea eliminada:", taskId);
          setErrorMessage("");
        } catch (error) {
          console.error("Error deleting task:", error);
          setErrorMessage("Error al eliminar la tarea.");
        }
      }
    );
  };

  // Actualizar estado de tarea (para Kanban)
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      // La ruta del documento ahora usa el projectId global
      await updateDoc(
        doc(
          db,
          `artifacts/${realProjectId}/public/data/projects/${projectId}/tasks`,
          taskId
        ),
        {
          status: newStatus,
        }
      );
      console.log(`Tarea ${taskId} actualizada a estado: ${newStatus}`);
      setErrorMessage("");
    } catch (error) {
      console.error("Error updating task status:", error);
      setErrorMessage("Error al actualizar el estado de la tarea.");
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Cargando proyecto...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={goToProjectList}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
        >
          &larr; Volver a Proyectos
        </button>
        <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400">
          {project.name}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingTask(null);
              setShowTaskModal(true);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Añadir Tarea
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Compartir
          </button>
          {activeTab === "gantt" && ( // Solo mostrar opciones de exportación/impresión en la vista de Gantt
            <ExportPrintOptions ganttChartRef={ganttChartRef} />
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4"
          role="alert"
        >
          <span className="block sm:inline">{errorMessage}</span>
          <span
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setErrorMessage("")}
          >
            <svg
              className="fill-current h-6 w-6 text-red-500"
              role="button"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <title>Close</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
            </svg>
          </span>
        </div>
      )}

      {/* Selector de vista */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setActiveTab("kanban")}
          className={`py-2 px-6 rounded-l-lg font-semibold transition duration-300 ease-in-out ${
            activeTab === "kanban"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          }`}
        >
          Tablero Kanban
        </button>
        <button
          onClick={() => setActiveTab("gantt")}
          className={`py-2 px-6 rounded-r-lg font-semibold transition duration-300 ease-in-out ${
            activeTab === "gantt"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          }`}
        >
          Diagrama de Gantt
        </button>
      </div>

      {activeTab === "kanban" ? (
        <KanbanBoard
          tasks={tasks}
          onEditTask={setEditingTask}
          onDeleteTask={deleteTask}
          onUpdateTaskStatus={updateTaskStatus}
          setShowTaskModal={setShowTaskModal}
        />
      ) : (
        <GanttChart
          tasks={tasks}
          onEditTask={setEditingTask}
          onDeleteTask={deleteTask}
          setShowTaskModal={setShowTaskModal}
          ref={ganttChartRef}
        />
      )}

      {/* Modal para Añadir/Editar Tarea */}
      {showTaskModal && (
        <TaskModal
          key={editingTask ? editingTask.id : "new-task"} // Clave para forzar el remounting y resetear el estado
          task={editingTask}
          onSave={saveTask}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {/* Modal para Compartir Proyecto */}
      {showShareModal && (
        <ShareModal
          projectCode={project.sharedCode}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

// Componente del Tablero Kanban
const KanbanBoard = ({
  tasks,
  onEditTask,
  onDeleteTask,
  onUpdateTaskStatus,
  setShowTaskModal,
}) => {
  const statuses = ["To Do", "In Progress", "Done"]; // Estados del Kanban

  // Manejar el inicio del arrastre
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData("taskId", task.id);
  };

  // Manejar el soltar en una columna
  const handleDrop = (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    onUpdateTaskStatus(taskId, status);
  };

  // Prevenir el comportamiento por defecto de arrastre
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {statuses.map((status) => (
        <div
          key={status}
          className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-lg p-4 shadow-inner min-w-[280px]"
          onDrop={(e) => handleDrop(e, status)}
          onDragOver={handleDragOver}
        >
          <h2 className="text-xl font-semibold mb-4 text-center text-gray-800 dark:text-gray-200 border-b pb-2 border-gray-300 dark:border-gray-700">
            {status}
          </h2>
          <div className="flex flex-col gap-3">
            {tasks
              .filter((task) => task.status === status)
              .map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  className="bg-white dark:bg-gray-700 rounded-lg shadow-md p-4 cursor-grab active:cursor-grabbing border border-gray-300 dark:border-gray-600 hover:shadow-lg transition-shadow duration-200"
                >
                  <h3 className="font-bold text-lg text-blue-700 dark:text-blue-300 mb-1">
                    {task.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Inicio: {new Date(task.startDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Fin: {new Date(task.endDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Responsable: {task.responsible}
                  </p>
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTask(task);
                        setShowTaskModal(true);
                      }}
                      className="text-blue-500 hover:text-blue-700 transition-colors duration-200"
                      title="Editar Tarea"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.828-2.829z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask(task.id);
                      }}
                      className="text-red-500 hover:text-red-700 transition-colors duration-200"
                      title="Eliminar Tarea"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            {tasks.filter((task) => task.status === status).length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm italic">
                Arrastra tareas aquí o añade una nueva.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Componente del Diagrama de Gantt (Simplificado y Mejorado)
const GanttChart = React.forwardRef(
  ({ tasks, onEditTask, onDeleteTask, setShowTaskModal }, ref) => {
    // Calculate the overall date range for the Gantt chart
    const allDates = tasks.flatMap((task) => [
      new Date(task.startDate),
      new Date(task.endDate),
    ]);
    let minDate =
      allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
    let maxDate =
      allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();

    // Ensure the range is at least one month for better visualization
    const oneMonthInMs = 30 * 24 * 60 * 60 * 1000;
    if (maxDate.getTime() - minDate.getTime() < oneMonthInMs) {
      maxDate.setMonth(minDate.getMonth() + 1);
    }

    // Normalize dates to start of the day
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);

    // Generate all days within the calculated range
    const days = [];
    let currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Function to get weekday initial
    const getWeekdayInitial = (date) => {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      switch (dayOfWeek) {
        case 1:
          return "L"; // Lunes
        case 2:
          return "M"; // Martes
        case 3:
          return "X"; // Miércoles
        case 4:
          return "J"; // Jueves
        case 5:
          return "V"; // Viernes
        default:
          return ""; // No show for Saturday/Sunday as per image
      }
    };

    // Group days into weeks for the header
    const weeks = [];
    let currentWeekStart = new Date(minDate);
    // Adjust currentWeekStart to the beginning of its week (Monday)
    currentWeekStart.setDate(
      currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7)
    ); // Monday of the week
    currentWeekStart.setHours(0, 0, 0, 0);

    let weekCounter = 1;
    while (currentWeekStart <= maxDate) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6); // End of the week (Sunday)
      weeks.push({
        start: new Date(currentWeekStart),
        end: new Date(weekEnd),
        name: `Semana ${weekCounter}`,
      });
      currentWeekStart.setDate(currentWeekStart.getDate() + 7); // Move to next week
      weekCounter++;
    }

    // Function to calculate the style of the task bar
    const getTaskBarStyle = (task) => {
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Normalize 'now' to start of the day

      const totalChartDurationDays = days.length; // Total days in the chart
      const taskStartOffsetDays =
        (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      const taskDurationDays =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1; // +1 to include the end day

      const leftPosition = (taskStartOffsetDays / totalChartDurationDays) * 100;
      const width = (taskDurationDays / totalChartDurationDays) * 100;

      let bgColorClass = "";
      let borderColorClass = "";
      let textColorClass = "text-white"; // Default text color

      // Logic for colors based on status and date
      if (task.status === "Done") {
        bgColorClass = "bg-green-500";
      } else if (end < now) {
        // Tarea vencida y no completada
        bgColorClass = "bg-red-500";
        borderColorClass = "border-red-700 border-2"; // Borde más pronunciado para vencidas
      } else if (task.status === "In Progress") {
        bgColorClass = "bg-yellow-500";
        textColorClass = "text-gray-900"; // Texto oscuro para contraste en amarillo
      } else {
        // To Do
        bgColorClass = "bg-blue-500"; // Azul para "Por Hacer"
      }

      // Reminder for tasks due in less than 24 hours (only if not done or overdue)
      const timeRemaining = end.getTime() - new Date().getTime(); // Real time remaining
      const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      // Apply pulsing orange border only if not done AND not already overdue
      if (
        task.status !== "Done" &&
        end >= now &&
        timeRemaining > 0 &&
        timeRemaining <= oneDay
      ) {
        borderColorClass = "border-orange-500 border-2 animate-pulse"; // Pulsing orange border
        bgColorClass = "bg-blue-500"; // Keep original color but add pulse effect
        textColorClass = "text-gray-900"; // Dark text for better contrast
      }

      return {
        left: `${leftPosition}%`,
        width: `${width}%`,
        className: `absolute h-7 rounded-md flex items-center justify-center text-xs px-2 shadow-sm ${bgColorClass} ${borderColorClass} ${textColorClass} transition-all duration-300 ease-in-out`,
      };
    };

    // Group tasks by a 'phase' property
    // If a task doesn't have a 'phase', it will be grouped under 'Tareas Generales'
    const groupedTasks = tasks.reduce((acc, task) => {
      const phaseName = task.phase || "Tareas Generales";
      if (!acc[phaseName]) {
        acc[phaseName] = [];
      }
      acc[phaseName].push(task);
      return acc;
    }, {});

    const phaseNames = Object.keys(groupedTasks).sort(); // Sort phases alphabetically

    // Calculate grid template columns for days to ensure equal width
    const dayColumnWidth = `minmax(50px, 1fr)`; // Each day column will be at least 50px, flexible
    const gridTemplateColumnsForDays = `200px repeat(${days.length}, ${dayColumnWidth})`;

    return (
      <div
        ref={ref}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 overflow-x-auto"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-700 dark:text-blue-300">
          Diagrama de Gantt
        </h2>
        {tasks.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-400">
            No hay tareas para mostrar en el Gantt. Añade algunas.
          </p>
        ) : (
          <div className="min-w-[1200px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Top Header Row: Weeks */}
            <div
              className="grid bg-blue-600 text-white font-bold text-center"
              style={{ gridTemplateColumns: gridTemplateColumnsForDays }}
            >
              <div className="py-3 px-3 border-r border-blue-700"></div>{" "}
              {/* Empty cell for task column */}
              {weeks.map((week, index) => {
                // Calculate how many days this week spans within the total chart days
                const daysInWeekInChart = days.filter(
                  (d) => d >= week.start && d <= week.end
                ).length;
                if (daysInWeekInChart === 0) return null;

                return (
                  <div
                    key={`week-${index}`}
                    className="py-3 border-l border-blue-700"
                    style={{ gridColumn: `span ${daysInWeekInChart}` }}
                  >
                    {week.name}
                  </div>
                );
              })}
            </div>

            {/* Second Header Row: Days */}
            <div
              className="grid bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600"
              style={{ gridTemplateColumns: gridTemplateColumnsForDays }}
            >
              <div className="font-semibold py-2 px-3 text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600"></div>{" "}
              {/* Empty cell */}
              {days.map((day, index) => (
                <div
                  key={index}
                  className="text-center text-xs font-semibold py-2 border-l border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <div className="text-[0.65rem] opacity-75">
                    {getWeekdayInitial(day)}
                  </div>{" "}
                  {/* Weekday initial */}
                  <div>
                    {day.getDate()}/{day.getMonth() + 1}
                  </div>{" "}
                  {/* Day/Month */}
                </div>
              ))}
            </div>

            {/* Task Rows - Grouped by Phase */}
            {phaseNames.map((phaseName) => (
              <React.Fragment key={phaseName}>
                {/* Phase Header Row */}
                <div
                  className="grid bg-blue-100 dark:bg-blue-900 border-b border-gray-300 dark:border-gray-600"
                  style={{ gridTemplateColumns: gridTemplateColumnsForDays }}
                >
                  <div className="font-bold py-3 px-3 text-blue-800 dark:text-blue-200 border-r border-gray-300 dark:border-gray-600">
                    {phaseName}
                  </div>
                  <div className="py-3 col-span-full"></div>{" "}
                  {/* Empty cell for timeline area */}
                </div>

                {/* Tasks within this Phase */}
                {groupedTasks[phaseName].map((task) => {
                  const style = getTaskBarStyle(task);
                  return (
                    <div
                      key={task.id}
                      className="grid items-center border-b border-gray-200 dark:border-gray-700 py-2 group hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                      style={{
                        gridTemplateColumns: gridTemplateColumnsForDays,
                      }}
                    >
                      <div className="font-medium text-gray-800 dark:text-gray-200 px-3 flex items-center justify-between min-h-[36px] border-r border-gray-200 dark:border-gray-700">
                        <span className="truncate pr-2">{task.name}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => {
                              onEditTask(task);
                              setShowTaskModal(true);
                            }}
                            className="text-blue-500 hover:text-blue-700"
                            title="Editar Tarea"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.828-2.829z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onDeleteTask(task.id)}
                            className="text-red-500 hover:text-red-700"
                            title="Eliminar Tarea"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div
                        className="relative h-8 col-span-full"
                        style={{ gridColumn: "2 / -1" }}
                      >
                        {" "}
                        {/* Span across all date columns */}
                        <div
                          className={style.className}
                          style={{
                            left: style.left,
                            width: style.width,
                          }}
                          title={`${task.name} (${new Date(
                            task.startDate
                          ).toLocaleDateString()} - ${new Date(
                            task.endDate
                          ).toLocaleDateString()})`}
                        >
                          {/* No text inside bar for cleaner look, name is in left column */}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
        {/* Leyenda de colores */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-inner">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Leyenda de Colores:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-green-500"></span> Tarea
              Realizada (Done)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-yellow-500"></span> En
              Progreso (In Progress)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500"></span> Por
              Hacer (To Do)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-red-500 border-red-700 border-2"></span>{" "}
              Tarea Vencida
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500 border-orange-500 border-2 animate-pulse"></span>{" "}
              Vence en &lt; 24h
            </div>
          </div>
        </div>
      </div>
    );
  }
);

// Componente para opciones de Exportar/Imprimir
const ExportPrintOptions = ({ ganttChartRef }) => {
  const { showAlert } = useContext(FirebaseContext);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleExportAsImage = async () => {
    setShowDropdown(false);
    // html2canvas se carga desde CDN, por lo que debería estar disponible globalmente.
    if (typeof window.html2canvas === "undefined") {
      showAlert(
        "Error: La librería html2canvas no está cargada. Por favor, recarga la página."
      );
      return;
    }
    const html2canvas = window.html2canvas; // Acceder a la función global

    if (ganttChartRef.current) {
      try {
        // Ocultar elementos que no queremos en la imagen (botones, etc.)
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden"; // Evitar barras de desplazamiento en la captura

        // Clonar el nodo para evitar modificar el DOM original visible
        const ganttElement = ganttChartRef.current;
        const clonedElement = ganttElement.cloneNode(true);
        clonedElement.style.position = "absolute";
        clonedElement.style.top = "0";
        clonedElement.style.left = "-9999px"; // Mover fuera de la vista
        clonedElement.style.width = ganttElement.scrollWidth + "px"; // Capturar todo el ancho desplazable
        clonedElement.style.height = ganttElement.scrollHeight + "px"; // Capturar toda la altura desplazable
        document.body.appendChild(clonedElement);

        // Asegurarse de que el contenido oculto esté visible para html2canvas
        const overflowElements = clonedElement.querySelectorAll(
          '[style*="overflow-x: auto"], [style*="overflow-y: auto"]'
        );
        overflowElements.forEach((el) => {
          el.style.overflowX = "visible";
          el.style.overflowY = "visible";
          el.style.width = el.scrollWidth + "px";
          el.style.height = el.scrollHeight + "px";
        });

        const canvas = await html2canvas(clonedElement, {
          scale: 2, // Aumentar la escala para mejor calidad
          useCORS: true, // Importante si hay imágenes externas, aunque no las usamos aquí
          scrollX: -window.scrollX, // Ajustar el scroll para la captura
          scrollY: -window.scrollY,
          windowWidth: document.documentElement.offsetWidth,
          windowHeight: document.documentElement.offsetHeight,
        });

        document.body.removeChild(clonedElement); // Limpiar el elemento clonado
        document.body.style.overflow = originalOverflow; // Restaurar overflow

        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = "diagrama-gantt.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert("Diagrama de Gantt exportado como imagen.");
      } catch (error) {
        console.error("Error al exportar el Gantt como imagen:", error);
        showAlert("Error al exportar el diagrama. Inténtalo de nuevo.");
      }
    } else {
      showAlert("El diagrama de Gantt no está listo para exportar.");
    }
  };

  const handlePrintChart = () => {
    setShowDropdown(false);
    // Ocultar elementos de la UI que no queremos imprimir
    const elementsToHide = document.querySelectorAll("body > div:not(#root)"); // Ajusta esto según tu estructura de DOM
    elementsToHide.forEach((el) => el.classList.add("no-print"));

    const ganttElement = ganttChartRef.current;
    if (ganttElement) {
      const originalDisplay = ganttElement.style.display;
      const originalWidth = ganttElement.style.width;
      const originalPosition = ganttElement.style.position;
      const originalLeft = ganttElement.style.left;
      const originalTop = ganttElement.style.top;

      // Preparar el elemento para la impresión
      ganttElement.style.width = "fit-content"; // Ajustar al contenido
      ganttElement.style.position = "fixed";
      ganttElement.style.top = "0";
      ganttElement.style.left = "0";
      ganttElement.style.zIndex = "9999"; // Asegurarse de que esté por encima de todo
      ganttElement.style.backgroundColor = "white"; // Fondo blanco para impresión

      // Crear un iframe para la impresión para aislar el contenido
      const printWindow = window.open("", "", "height=600,width=800");
      printWindow.document.write(
        "<html><head><title>Diagrama de Gantt</title>"
      );
      // Incluir estilos de Tailwind CSS para la impresión
      printWindow.document.write(
        '<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">'
      );
      printWindow.document.write("<style>");
      printWindow.document.write(
        "@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }"
      );
      printWindow.document.write("</style>");
      printWindow.document.write("</head><body>");
      printWindow.document.write(ganttElement.outerHTML); // Usar outerHTML para incluir el elemento y sus estilos
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();

        // Restaurar estilos originales después de la impresión
        ganttElement.style.display = originalDisplay;
        ganttElement.style.width = originalWidth;
        ganttElement.style.position = originalPosition;
        ganttElement.style.top = originalTop;
        ganttElement.style.left = originalLeft;
        ganttElement.style.zIndex = "";
        ganttElement.style.backgroundColor = "";

        elementsToHide.forEach((el) => el.classList.remove("no-print"));
      };
    } else {
      showAlert("El diagrama de Gantt no está listo para imprimir.");
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 ml-2"
      >
        Exportar / Imprimir
        <svg
          className="ml-2 -mr-0.5 h-4 w-4 inline"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10">
          <div className="py-1">
            <button
              onClick={handleExportAsImage}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              Exportar como Imagen (.png)
            </button>
            <button
              onClick={handlePrintChart}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              Imprimir Diagrama
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente Modal genérico
const Modal = ({ title, children, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md relative transform transition-all duration-300 scale-100 opacity-100 max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-600 dark:text-blue-400">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
};

// Componente Modal para Tareas (Añadir/Editar)
const TaskModal = ({ task, onSave, onClose }) => {
  const [name, setName] = useState(task?.name || "");
  const [startDate, setStartDate] = useState(task?.startDate || "");
  const [endDate, setEndDate] = useState(task?.endDate || "");
  const [responsible, setResponsible] = useState(task?.responsible || "");
  const [status, setStatus] = useState(task?.status || "To Do");
  const [phase, setPhase] = useState(task?.phase || ""); // Added phase state
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate || !responsible.trim()) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    onSave({
      name,
      startDate,
      endDate,
      responsible,
      status,
      phase: phase.trim() || null,
    }); // Save phase
    setError(""); // Limpiar el error después de una validación exitosa
  };

  return (
    <Modal
      title={task ? "Editar Tarea" : "Añadir Nueva Tarea"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <div>
          <label
            htmlFor="taskName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Nombre de la Tarea
          </label>
          <input
            type="text"
            id="taskName"
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Fecha de Inicio
          </label>
          <input
            type="date"
            id="startDate"
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label
            htmlFor="endDate"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Fecha de Fin
          </label>
          <input
            type="date"
            id="endDate"
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label
            htmlFor="responsible"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Responsable
          </label>
          <input
            type="text"
            id="responsible"
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            required
          />
        </div>
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Estado
          </label>
          <select
            id="status"
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="To Do">Por Hacer</option>
            <option value="In Progress">En Progreso</option>
            <option value="Done">Hecho</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="phase"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Fase (Opcional)
          </label>
          <input
            type="text"
            id="phase"
            className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ej: Fase uno, Preparación"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
        >
          {task ? "Guardar Cambios" : "Añadir Tarea"}
        </button>
      </form>
    </Modal>
  );
};

// Componente Modal para Compartir
const ShareModal = ({ projectCode, onClose }) => {
  const { showAlert } = useContext(FirebaseContext); // Usar showAlert del contexto

  const copyToClipboard = () => {
    const el = document.createElement("textarea");
    el.value = projectCode;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    showAlert("¡Código copiado al portapapeles!"); // Usar el modal personalizado
  };

  return (
    <Modal title="Compartir Proyecto" onClose={onClose}>
      <p className="text-center text-gray-700 dark:text-gray-300 mb-4">
        Comparte este código con otros para que puedan unirse a tu proyecto:
      </p>
      <div className="flex items-center justify-center mb-4">
        <span className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-2xl font-mono p-3 rounded-lg border border-gray-300 dark:border-gray-600 select-all">
          {projectCode}
        </span>
        <button
          onClick={copyToClipboard}
          className="ml-3 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          title="Copiar al portapapeles"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
        </button>
      </div>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Los usuarios pueden usar este código para unirse a tu proyecto desde la
        pantalla principal.
      </p>
    </Modal>
  );
};

// Componente para modales de interacción (alerta/confirmación)
const CustomInteractionModal = ({
  message,
  onClose,
  onConfirm,
  showCancel = false,
}) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-sm relative transform transition-all duration-300 scale-100 opacity-100">
        <h2 className="text-xl font-bold mb-4 text-center text-gray-800 dark:text-gray-200">
          {onConfirm ? "Confirmación" : "Atención"}
        </h2>
        <p className="text-center text-gray-700 dark:text-gray-300 mb-6">
          {message}
        </p>
        <div className="flex justify-center gap-4">
          {showCancel && (
            <button
              onClick={onClose} // onClose actúa como cancelar
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={onConfirm || onClose} // Si onConfirm existe, se llama, de lo contrario se llama onClose
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            {onConfirm ? "Confirmar" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
