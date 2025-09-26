document.addEventListener('DOMContentLoaded', () => {
    const formCrear = document.getElementById('form-crear-usuario');
    const tbodyUsuarios = document.getElementById('lista-usuarios');

    const eliminarUsuario = async (id) => {
    // Aquí va el fetch DELETE al puerto 4000
    try {
        const response = await fetch(`/api/usuarios/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Usuario eliminado correctamente.');
            cargarUsuarios(); // Llama a la función de recarga
        } else {
            throw new Error(`Error ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Falló la eliminación: ' + error.message);
    }
    };
    
    // Función para obtener y mostrar los usuarios desde el backend
    async function cargarUsuarios() {
        tbodyUsuarios.innerHTML = ''; // Limpiar la tabla
        try {
            const response = await fetch('/api/usuarios');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error('Error al cargar la lista de usuarios: ' + errorText);
            }
            
            const usuarios = await response.json();
            
            if (usuarios.length > 0) {
                usuarios.forEach(usuario => {
                    const fila = document.createElement('tr');
                    fila.innerHTML = `
                        <td>${usuario.Id}</td>
                        <td>${usuario.NombreUsuario}</td>
                        <td>${usuario.Rol}</td>
                        <td>${usuario.Activo ? 'Sí' : 'No'}</td>
                        <td>
                            <button class="edit-btn" data-id="${usuario.Id}">Editar</button>
                            <button class="delete-btn" data-id="${usuario.Id}">Eliminar</button>
                        </td>
                    `;
                    tbodyUsuarios.appendChild(fila);
                });
            } else {
                tbodyUsuarios.innerHTML = `<tr><td colspan="5">No hay usuarios para mostrar.</td></tr>`;
            }

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    const fila = e.target.closest('tr');
                    const nombre = fila.querySelector('td:nth-child(2)').textContent;
                    const rol = fila.querySelector('td:nth-child(3)').textContent;
                    const activo = fila.querySelector('td:nth-child(4)').textContent === 'Sí';
                    
                    prepararModificacion(id, nombre, rol, activo);
                });
            });

            // Listeners para eliminar
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    const ok = confirm(`¿Seguro que deseas eliminar al usuario con ID ${id}?`);
                    if (ok) {
                        await eliminarUsuario(id);
                    }
                });
            });


        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            alert('No se pudo cargar la lista de usuarios. Revisa la consola para más detalles.');
        }
    }

    // Función para manejar la creación de un nuevo usuario
    formCrear.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombreUsuario = document.getElementById('nombre-crear').value;
        const contrasena = document.getElementById('contrasena-crear').value;
        const rol = document.getElementById('rol-crear').value;
        const activo = document.getElementById('activo-crear').value === 'true';

        try {
            const response = await fetch('/api/usuarios/crear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombreUsuario, contrasena, rol, activo })
            });

            const data = await response.text();
            if (response.ok) {
                alert(data);
                formCrear.reset();
                cargarUsuarios(); // Recargar la lista
            } else {
                alert('Error: ' + data);
            }
        } catch (error) {
            console.error('Error al crear usuario:', error);
            alert('Ocurrió un error al crear el usuario.');
        }
    });

    // Función para la modificación
    function prepararModificacion(id, nombre, rol, activo) {
        const nuevoNombre = prompt(`Modificar nombre para ${nombre}:`, nombre);
        const nuevoRol = prompt(`Modificar rol para ${nombre} (Administrador/Usuario):`, rol);
        const nuevoActivo = prompt(`Modificar estado para ${nombre} (true/false):`, activo);
        
        if (nuevoNombre !== null && nuevoRol !== null && nuevoActivo !== null) {
            modificarUsuario(id, nuevoNombre, nuevoRol, nuevoActivo === 'true');
        }
    }

    // Función para enviar la solicitud de modificación al backend
    async function modificarUsuario(id, nombreUsuario, rol, activo) {
        try {
            const response = await fetch(`https://guatepath-api-service-cparavh2h4ahhrhv.azurewebsites.net/usuarios/modificar/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombreUsuario, rol, activo })
            });
            const data = await response.text();
            alert(data);
            if (response.ok) {
                cargarUsuarios();
            }
        } catch (error) {
            console.error('Error al modificar usuario:', error);
        }
    }

    // Iniciar la carga de usuarios al cargar la página
    cargarUsuarios();
});