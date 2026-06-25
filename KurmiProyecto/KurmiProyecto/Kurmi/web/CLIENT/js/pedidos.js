// Importamos la función 'components' de un archivo de ayuda externa para poder reutilizar piezas visuales compartidas
import { components } from '../../helpers/index.js';

// Definimos una función asíncrona para cargar los módulos o componentes visuales de la página
async function cargarModulos() {
    // Paso 1: Carga los componentes visuales repetitivos de la página
    // Esperamos a que se carguen al mismo tiempo la cabecera (header) y el pie de página (footer)
    await Promise.all([
        // Descargamos la estructura visual de la cabecera de la página
        components('header', '../../components/header.html'),
        // Descargamos la estructura visual del pie de página de la página
        components('footer', '../../components/footer.html')
    ]);
    // Paso 2: Invoca al guardián de seguridad del Frontend
    // Llamamos a la función que valida si el usuario ha iniciado sesión y guardamos el resultado
    const tieneSesion = await verificarSesion();
    // Paso 3: ¡El freno de mano! Si verificarSesion devolvió 'false', detiene todo.
    // Si el usuario no ha iniciado sesión, detenemos la ejecución de esta función
    if (!tieneSesion) return;
    // Paso 4: Si todo está en orden, inicializa la página normalmente
    // Activamos la escucha de clics en las pestañas de estados de pedidos
    inicializarFiltros();
    // Cargamos inicialmente la pestaña de pedidos en estado "Pendiente" (estado número 1)
    cargarPedidos('1'); 
}
// Ejecutamos la función de carga de módulos inmediatamente al abrir la página
cargarModulos();

// ── Verificar sesión ──────────────────────────────────────────────────────────
// Definimos una función asíncrona para validar si el usuario está conectado
async function verificarSesion() {
    try {
        // 1. Toca la puerta del servidor en el PerfilServlet
        // Hacemos una llamada de red al servidor solicitando los datos del perfil
        const res = await fetch('/KurmiProyect/PerfilServlet');
        // 2. El AuthHelper de Java respondió con un 401 Unauthorized
        // Si el servidor responde que no estamos autorizados (sesión no iniciada)
        if (res.status === 401) { 
            // Redireccionamos de inmediato al usuario a la página de inicio de sesión
            window.location.replace('/KurmiProyect/inicioSesion.html'); 
            // Devolvemos falso indicando falta de sesión
            return false; 
        }
        // Si el servidor responde con un estado 403 (prohibido)
        if (res.status === 403) {
            // Sí está logueado, pero es un intruso en este módulo
            // Alertamos al usuario indicando el fallo de permisos
            alert('No tienes permisos de Administrador/Proveedor para ver esta sección.');
            // Devolvemos falso
            return false;
        }
        // 3. Si no fue 401, significa que sí hay sesión. Extrae los datos del UsuarioDTO
        // Convertimos la respuesta de red a un formato de objeto JSON
        const usuario = await res.json();
        // 4. Busca el elemento HTML y le pinta el nombre real del usuario logueado (ej: Eileen)
        // Buscamos la etiqueta de texto donde se muestra el nombre del usuario
        const span = document.getElementById('nombreUsuario');
        // Si esa etiqueta existe en el diseño, le asignamos el nombre del usuario
        if (span) span.textContent = usuario.nombres || '';
        // Le da luz verde a cargarModulos() devolviendo verdadero
        return true;
    } catch (e) {
        // Si el servidor está caído o hay un error de red catastrófico, también lo bota al login
        // Redireccionamos a la página de inicio de sesión
        window.location.replace('/KurmiProyect/inicioSesion.html');
        // Devolvemos falso indicando fallo
        return false;
    }
}

// ── Filtros ───────────────────────────────────────────────────────────────────
// Definimos una función para configurar los botones de filtro de estados en la página
function inicializarFiltros() {
    // Buscamos todos los botones que pertenezcan a la clase de filtro (.filtro__btn) y los recorremos
    document.querySelectorAll('.filtro__btn').forEach(btn => {
        // Escuchamos el clic en cada botón de filtro
        btn.addEventListener('click', () => {
            // Desmarcamos visualmente todos los botones quitándoles la clase de activo
            document.querySelectorAll('.filtro__btn').forEach(b => b.classList.remove('filtro__btn--activo'));
            // Marcamos visualmente el botón al que se le hizo clic
            btn.classList.add('filtro__btn--activo');

            // Leemos el estado del pedido guardado en el atributo 'data-estado' del botón
            const estado = btn.dataset.estado;
            // Si el estado seleccionado corresponde a 'devoluciones'
            if (estado === 'devoluciones') {
                // Llamamos a la función encargada de listar las devoluciones del cliente
                cargarMisDevoluciones();
            // Para otros estados
            } else {
                // Cargamos los pedidos correspondientes al estado seleccionado
                cargarPedidos(estado);
            }
        });
    });
    // Buscamos el botón de pendientes por defecto en la página
    const btnPendiente = document.querySelector('.filtro__btn[data-estado="1"]');
    // Si existe el botón de pendientes, lo marcamos visualmente activo al cargar la página
    if (btnPendiente) btnPendiente.classList.add('filtro__btn--activo');
}

// ── Helpers de mensajes de estado ───────────────────────────────────────────
// Definimos una función para pintar un mensaje de aviso en pantalla
function mostrarMensajeEstado(grid, clase, texto) {
    // Vaciamos por completo el contenedor de pedidos en la página
    grid.innerHTML = '';
    // Creamos en memoria un nuevo párrafo de texto
    const p = document.createElement('p');
    // Le asignamos la clase de estilo visual
    p.className = clase;
    // Le asignamos el mensaje explicativo
    p.textContent = texto;
    // Insertamos el párrafo dentro del contenedor de pedidos
    grid.appendChild(p);
}

// ── Cargar pedidos del servidor ───────────────────────────────────────────────
// Definimos una función asíncrona para descargar los pedidos del usuario
async function cargarPedidos(estado) {
    // Buscamos la cuadrícula de pedidos en pantalla
    const grid = document.getElementById('pedidosGrid');
    // Mostramos un mensaje de "Cargando..." al usuario mientras se realiza la descarga
    mostrarMensajeEstado(grid, 'pedidos__cargando', 'Cargando...');

    try {
        // Para pestañas "1" y "en_proceso" el servidor devuelve todos juntos
        // (estados 1,4,5,6,7 con sub-pedidos por proveedor); filtramos aquí
        // Determinamos el parámetro de estado a enviar al servidor
        const estadoParam = (estado === '1' || estado === 'en_proceso') ? '1' : estado;
        // Hacemos la llamada fetch solicitando los pedidos con el estado correspondiente
        const res = await fetch('/KurmiProyect/PedidosServlet?estado=' + estadoParam);
        // Si la sesión expiró en el servidor, redireccionamos al login y salimos
        if (res.status === 401) { window.location.replace('/KurmiProyect/inicioSesion.html'); return; }

        // Convertimos el listado de pedidos devuelto a formato JSON
        let pedidos = await res.json();
        // Registramos en consola la respuesta del servidor para desarrollo
        console.log('Pedidos recibidos del servidor:', JSON.stringify(pedidos, null, 2));
        // Limpiamos la cuadrícula de la página
        grid.innerHTML = '';

        // Filtrar por pestaña activa
        // Si el estado seleccionado es "Pendientes"
        if (estado === '1') {
            // Filtramos localmente para quedarnos únicamente con los que tengan estado 1 (Pendiente)
            pedidos = pedidos.filter(p => p.estadoPedido === 1);
        // Si el estado seleccionado es "En proceso"
        } else if (estado === 'en_proceso') {
            // Filtramos localmente para quedarnos con los estados en preparación, bodega, empacado o transporte (4, 5, 6, 7)
            pedidos = pedidos.filter(p => [4, 5, 6, 7].includes(p.estadoPedido));
        }

        // Definimos etiquetas sencillas para mostrar en pantalla si el listado está vacío
        const etiquetas = {
            '1':          'pedidos pendientes',
            'en_proceso': 'pedidos en proceso',
            '11':         'solicitudes de cancelación',
            '8':          'pedidos entregados',
            '9':          'pedidos en devolución',
            '3':          'pedidos cancelados'
        };

        // Si la lista de pedidos está vacía o no existe
        if (!pedidos || pedidos.length === 0) {
            // Pintamos en pantalla un aviso informando que no hay pedidos en esta pestaña
            mostrarMensajeEstado(grid, 'pedidos__vacio', `:( No tienes ${etiquetas[estado] || 'pedidos'} aún.`);
            return;
        }

        // Recorremos cada uno de los pedidos del listado
        pedidos.forEach(pedido => {
            // Creamos la tarjeta visual para presentar el pedido
            const card = crearTarjetaPedido(pedido, estado);
            // Insertamos la tarjeta en la cuadrícula de la página
            grid.appendChild(card);
        });

    } catch (e) {
        // En caso de que ocurra algún fallo de red
        // Registramos el error en la consola
        console.error('Error cargando pedidos:', e);
        // Mostramos un aviso de error visual al usuario
        mostrarMensajeEstado(grid, 'pedidos__vacio', 'Error al cargar pedidos.');
    }
}

// ── Crear tarjeta de pedido ───────────────────────────────────────────────────
// Definimos una función para construir visualmente la tarjeta de un pedido con sus datos
function crearTarjetaPedido(pedido, filtroActivo) {
    // Creamos la caja div principal para la tarjeta
    const card = document.createElement('div');
    // Le asignamos la clase CSS
    card.className = 'pedido__card';

    // Creamos la etiqueta de imagen del pedido
    const img = document.createElement('img');
    img.className = 'pedido__img';
    // Definimos la carpeta base de imágenes en el servidor
    const BASE_IMG = '/KurmiProyect/RESOURCES/img/';
    // Tomamos la imagen del primer producto del pedido
    const imgNombre = pedido.imagenPrimera;
    // Si tiene imagen asignada, construimos la ruta completa, de lo contrario usamos la de por defecto
    img.src = (imgNombre && imgNombre !== 'inicioHelado.png')
        ? BASE_IMG + imgNombre
        : '../../RESOURCES/img/inicioHelado.png';
    img.alt = 'Pedido';

    // Creamos la caja div para los detalles textuales
    const info = document.createElement('div');
    info.className = 'pedido__info';

    // Creamos un párrafo para la fecha del pedido
    const fecha = document.createElement('p');
    fecha.className = 'pedido__fecha';
    fecha.textContent = 'Pedido del ' + (pedido.fechaPedido || '');

    // Obtenemos los colores asignados para el estado actual del pedido
    const badgeCfg = estadoBadgeConfig(pedido.estadoPedido);
    // Creamos un span para pintar la etiqueta del estado
    const badge = document.createElement('span');
    badge.className = 'pedido__estado-badge';
    badge.textContent = pedido.nombreEstado || '';
    // Le aplicamos el color de fondo y de texto obtenido
    badge.style.background = badgeCfg.bg;
    badge.style.color = badgeCfg.color;

    // Creamos un párrafo para el total de productos comprados
    const detalle = document.createElement('p');
    detalle.className = 'pedido__detalle';
    detalle.textContent = 'Total productos: ' + (pedido.totalProductos || 0);

    // Se calcula el total sumando los precioTotal de todos los productos del pedido.
    // pedido.totalPago puede ser solo el subtotal de un proveedor en compras multi-proveedor.
    // Obtenemos todos los productos uniendo los subtítulos si es multi-proveedor
    const todosProds = (pedido.productos && pedido.productos.length > 0)
        ? pedido.productos
        : (pedido.subpedidos || []).flatMap(s => s.productos || []);
    // Sumamos los precios de cada producto para calcular el total exacto del pedido
    const totalReal = todosProds.length > 0
        ? todosProds.reduce((acc, p) => acc + Number(p.precioTotal || 0), 0)
        : Number(pedido.totalPago);
    // Creamos un párrafo para el precio total
    const total = document.createElement('p');
    total.className = 'pedido__total';
    // Mostramos el precio total formateado con separadores de miles
    total.textContent = 'Total: $' + totalReal.toLocaleString('es-CO');

    // Metemos la fecha, etiqueta de estado, detalle de cantidad y total dentro de la caja de información
    info.appendChild(fecha);
    info.appendChild(badge);
    info.appendChild(detalle);
    info.appendChild(total);

    // Los estados de proveedor no se muestran al cliente

    // Metemos la imagen y la caja de información dentro de la tarjeta del pedido
    card.appendChild(img);
    card.appendChild(info);

    // Botón cancelar — solo en Pendiente (1)
    // Si la pestaña activa es Pendiente y el pedido está pendiente (estado 1)
    if (filtroActivo === '1' && pedido.estadoPedido === 1) {
        // Creamos un botón para cancelar el pedido
        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'btn__pedido-cancelar';
        btnCancelar.textContent = 'Cancelar pedido';
        // Escuchamos el clic en el botón cancelar
        btnCancelar.addEventListener('click', e => {
            // Evitamos que el clic abra los detalles de la tarjeta al propagarse
            e.stopPropagation();
            // Llamamos a la función de confirmación y envío de cancelación
            confirmarCancelacion(pedido.idPedido);
        });
        // Metemos el botón cancelar en la tarjeta
        card.appendChild(btnCancelar);
    }

    // Botón devolver — SOLO en Entregado (8) y si no pasó más de 24 horas.
    // Se muestra aquí solo cuando el pedido tiene un único proveedor (un solo sub-pedido),
    // porque en ese caso no hay ambigüedad sobre a cuál sub-pedido aplica la devolución.
    // Cuando hay varios proveedores, el cliente abre el modal y usa el botón
    // de devolución de cada producto individual (cada uno apunta a su propio sub-pedido).
    // Validamos si es una compra con un único proveedor
    const esUnSoloProveedor = !pedido.idsPedidos || pedido.idsPedidos.length <= 1;
    // Si el pedido está entregado, la pestaña activa es Entregados y es de un único proveedor
    if (filtroActivo === '8' && pedido.estadoPedido === 8 && esUnSoloProveedor) {
        // Se usa fechaPedidoCompleta (con hora exacta) para que el cálculo de 24 h sea preciso.
        // Usar solo la fecha recortada (yyyy-MM-dd) forzaría el inicio a medianoche
        // y haría expirar la ventana horas antes de lo que corresponde.
        // Leemos la fecha completa del pedido
        const fechaRaw     = pedido.fechaPedidoCompleta || pedido.fechaPedido;
        // Creamos un objeto de fecha con la fecha de compra
        const fechaEntrega = new Date(fechaRaw.replace(' ', 'T'));
        // Obtenemos la fecha y hora actuales
        const ahora        = new Date();
        // Calculamos la diferencia en horas transcurridas
        const diffHoras    = (ahora - fechaEntrega) / (1000 * 60 * 60);

        // Si ha pasado menos de 24 horas y no se ha solicitado una devolución para este pedido aún
        if (diffHoras <= 24 && !pedido.tieneDevolucion) {
            // Creamos un botón para solicitar la devolución
            const btnDevolver = document.createElement('button');
            btnDevolver.className = 'btn__pedido-devolver';
            btnDevolver.textContent = 'Solicitar devolución';
            // Escuchamos el clic en el botón de devolución
            btnDevolver.addEventListener('click', e => {
                // Detenemos la propagación del clic
                e.stopPropagation();
                // Obtenemos el ID del pedido correcto a devolver
                const idParaDevolucion = (pedido.idsPedidos && pedido.idsPedidos.length > 0)
                    ? pedido.idsPedidos[0]
                    : pedido.idPedido;
                // Abrimos el formulario modal de devoluciones
                abrirFormDevolucion(idParaDevolucion, pedido.fechaPedido);
            });
            // Metemos el botón en la tarjeta
            card.appendChild(btnDevolver);
        }
    }

    // Botón factura — aparece en TODOS los pedidos sin importar el estado
    // Creamos un botón para ver la factura
    const btnFactura = document.createElement('button');
    btnFactura.className = 'btn__pedido-factura';
    btnFactura.textContent = 'Ver factura';
    // Escuchamos el clic en el botón de factura
    btnFactura.addEventListener('click', e => {
        // Evitamos la propagación del clic
        e.stopPropagation();
        // Generamos visualmente el PDF de la factura
        generarFacturaPDF(pedido);
    });
    // Metemos el botón de factura en la tarjeta
    card.appendChild(btnFactura);

    // Escuchamos el clic en cualquier otra parte de la tarjeta para abrir el modal de detalles del pedido
    card.addEventListener('click', () => abrirModal(pedido, filtroActivo));
    // Devolvemos la tarjeta configurada
    return card;
}

// ── Factura descargable ───────────────────────────────────────────────────────
// Definimos una función asíncrona para generar y abrir la factura en una ventana imprimible
async function generarFacturaPDF(pedido) {
    // Obtenemos los colores del estado
    const badgeCfg  = estadoBadgeConfig(pedido.estadoPedido);
    // Extraemos los datos del pedido (estado, fecha, método, total, receptor, dirección y teléfono)
    const estado    = pedido.nombreEstado || '—';
    const fecha     = pedido.fechaPedido  || '—';
    const metodo    = pedido.metodoPago   || 'No registrado';
    const total     = Number(pedido.totalPago).toLocaleString('es-CO');
    const receptor  = pedido.receptor  || pedido.nombreReceptor  || '—';
    const direccion = pedido.direccion || pedido.direccionEnvio   || '—';
    const telefono  = pedido.telefono  || pedido.telefonoEnvio    || '—';

    // Cargar la plantilla de la factura
    // Descargamos el diseño de la factura
    const responseTemplate = await fetch('/KurmiProyect/components/facturaPedido.html');
    const templateHTML = await responseTemplate.text();

    // Abrimos una nueva ventana en blanco en el navegador
    const ventana = window.open('', '_blank', 'width=800,height=700');
    // Escribimos la plantilla descargada dentro del documento de la nueva ventana
    ventana.document.write(templateHTML);
    // Cerramos la edición del documento de la ventana para que se dibuje
    ventana.document.close();

    // Rellenar contenido dinámico una vez la ventana terminó de cargar
    // Apuntamos al documento de la nueva ventana
    const doc = ventana.document;

    // Rellenamos el número de factura comprobando si son múltiples pedidos unidos
    doc.getElementById('facturaNumero').textContent = pedido.idsPedidos && pedido.idsPedidos.length > 1
        ? `Pedidos #${pedido.idsPedidos.join(', #')}`
        : `Factura #${pedido.idPedido}`;
    // Rellenamos la fecha
    doc.getElementById('facturaFechaHeader').textContent = `Fecha: ${fecha}`;

    // Buscamos el badge del estado en el documento de la factura
    const badge = doc.getElementById('facturaEstadoBadge');
    // Le escribimos el estado
    badge.textContent = estado;
    // Le aplicamos el color de fondo y texto
    badge.style.background = badgeCfg.bg;
    badge.style.color = badgeCfg.color;

    // Rellenamos los datos del cliente, método de pago, fecha de pago y total de compra en el PDF
    doc.getElementById('facturaReceptor').textContent  = receptor;
    doc.getElementById('facturaDireccion').textContent = direccion;
    doc.getElementById('facturaTelefono').textContent  = telefono;
    doc.getElementById('facturaMetodo').textContent    = metodo;
    doc.getElementById('facturaFechaPago').textContent = fecha;
    doc.getElementById('facturaTotal').textContent     = `$${total}`;

    // Construir las filas de productos sin HTML incrustado
    // Buscamos el cuerpo de la tabla de productos de la factura
    const tbody = doc.getElementById('facturaFilasProductos');

    // Igual que en el modal de detalle: los productos pueden venir
    // planos en pedido.productos o agrupados por proveedor en pedido.subpedidos
    // Unimos los productos en una única lista plana
    const todosLosProductos = (pedido.subpedidos && pedido.subpedidos.length > 0)
        ? pedido.subpedidos.flatMap(sub => sub.productos || [])
        : (pedido.productos || []);

    // Recorremos la lista de productos
    todosLosProductos.forEach(p => {
        // Creamos una fila (tr) de tabla en el documento de la ventana
        const tr = doc.createElement('tr');

        // Creamos la columna para el nombre del producto
        const tdNombre = doc.createElement('td');
        tdNombre.textContent = p.nombre || '—';

        // Creamos la columna para la cantidad comprada
        const tdCantidad = doc.createElement('td');
        tdCantidad.className = 'col-num';
        tdCantidad.textContent = p.cantidad;

        // Creamos la columna para el precio unitario
        const tdPrecio = doc.createElement('td');
        tdPrecio.className = 'col-precio';
        // Calculamos el precio unitario dividiendo si no está especificado directamente
        const precioUnit = p.precio != null
            ? Number(p.precio)
            : (p.cantidad ? Number(p.precioTotal || 0) / p.cantidad : 0);
        tdPrecio.textContent = `$${precioUnit.toLocaleString('es-CO')}`;

        // Creamos la columna para el subtotal (cantidad por precio)
        const tdSubtotal = doc.createElement('td');
        tdSubtotal.className = 'col-subtotal';
        tdSubtotal.textContent = `$${Number(p.precioTotal || 0).toLocaleString('es-CO')}`;

        // Agregamos todas las columnas creadas a la fila
        tr.appendChild(tdNombre);
        tr.appendChild(tdCantidad);
        tr.appendChild(tdPrecio);
        tr.appendChild(tdSubtotal);
        // Agregamos la fila al cuerpo de la tabla
        tbody.appendChild(tr);
    });

    // Botón de imprimir
    // Buscamos el botón de imprimir de la factura
    const btnImprimir = doc.getElementById('btnImprimirFactura');
    // Si el botón existe
    if (btnImprimir) {
        // Escuchamos el clic e invocamos el diálogo de impresión nativo del navegador sobre la nueva ventana
        btnImprimir.addEventListener('click', () => ventana.print());
    }
}

// ── Config de color por estado ────────────────────────────────────────────────
// Definimos una función para obtener el color de fondo y de texto correspondiente a cada estado de pedido
function estadoBadgeConfig(estadoPedido) {
    // Creamos un mapa de configuraciones de color
    const configs = {
        1:  { bg: '#e67e22', color: '#fff' }, // Pendiente
        3:  { bg: '#e74c3c', color: '#fff' }, // Cancelado
        4:  { bg: '#f39c12', color: '#fff' }, // Preparando
        5:  { bg: '#3498db', color: '#fff' }, // En bodega
        6:  { bg: '#9b59b6', color: '#fff' }, // Empacando
        7:  { bg: '#1abc9c', color: '#fff' }, // Transportando
        8:  { bg: '#2ecc71', color: '#fff' }, // Entregado
        9:  { bg: '#c0392b', color: '#fff' }, // Devolución
        10: { bg: '#8e44ad', color: '#fff' }, // Devolución Solicitada
        11: { bg: '#f39c12', color: '#fff' }  // Cancelación Solicitada
    };
    // Devolvemos los colores del estado correspondiente o un color gris por defecto
    return configs[estadoPedido] || { bg: '#aaa', color: '#fff' };
}

// ── Cancelar pedido — Modal con motivo ────────────────────────────────────────
// Definimos una función asíncrona para abrir el modal de cancelación de pedido
async function confirmarCancelacion(idPedido) {
    // Eliminar modal previo si existe en la página
    const previo = document.getElementById('modalCancelacionOverlay');
    // Si existe, lo quitamos
    if (previo) previo.remove();

    // Descargamos el diseño visual del modal de cancelación
    const responseTemplate = await fetch('/KurmiProyect/components/modalCancelacionPedido.html');
    const templateHTML = await responseTemplate.text();

    // Creamos la caja contenedora del modal en la página
    const overlay = document.createElement('div');
    overlay.id = 'modalCancelacionOverlay';
    overlay.className = 'modal__overlay';
    // Le incrustamos el diseño descargado
    overlay.innerHTML = templateHTML;
    // Metemos el modal al final del body de la página
    document.body.appendChild(overlay);

    // Escribimos el subtítulo del modal indicando el número de pedido
    overlay.querySelector('#cancelSubtitulo').textContent =
        `Pedido #${idPedido} — indica el motivo de la cancelación.`;

    // Buscamos los elementos del formulario dentro del modal (motivo, contador de letras, error y botón de confirmación)
    const textarea  = document.getElementById('cancelMotivo');
    const contador  = document.getElementById('cancelContador');
    const errorEl   = document.getElementById('cancelError');
    const btnConf   = document.getElementById('cancelBtnConfirmar');

    // Definimos una función interna para remover el modal
    const cerrar = () => overlay.remove();

    // Escuchamos cuando el usuario escribe en la caja de texto para actualizar el contador de caracteres en tiempo real
    textarea.addEventListener('input', () => {
        contador.textContent = textarea.value.length;
    });

    // Escuchamos el clic en la X de cerrar
    document.getElementById('cancelModalCerrar').addEventListener('click', cerrar);
    // Escuchamos el clic en el botón de volver atrás
    document.getElementById('cancelBtnVolver').addEventListener('click', cerrar);
    // Escuchamos el clic en el fondo oscuro del modal para cerrarlo
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

    // Escuchamos el clic en el botón de confirmar la cancelación
    btnConf.addEventListener('click', async () => {
        // Leemos el motivo escrito por el usuario quitando espacios
        const motivo = textarea.value.trim();
        // Si la caja de texto está completamente vacía
        if (!motivo) {
            // Mostramos una advertencia de error al usuario y salimos
            errorEl.textContent = '⚠ Por favor escribe el motivo antes de continuar.';
            errorEl.classList.remove('hidden');
            return;
        }

        // Desactivamos el botón de confirmar para evitar envíos duplicados
        btnConf.disabled = true;
        // Cambiamos el texto del botón a "Enviando..."
        btnConf.textContent = 'Enviando…';
        // Ocultamos el mensaje de error anterior
        errorEl.classList.add('hidden');

        try {
            // Enviamos la petición POST al Servlet encargado de cambiar los estados del pedido
            const res = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'idPedido=' + encodeURIComponent(idPedido) +
                      '&nuevoEstado=3' +
                      '&motivo=' + encodeURIComponent(motivo)
            });
            // Convertimos la respuesta del servidor a formato JSON
            const data = await res.json();
            // Si el servidor confirma que se guardó correctamente
            if (data.ok) {
                // Cerramos el modal
                cerrar();
                // Mostramos un mensaje emergente confirmando el envío al usuario
                mostrarNotificacion('Solicitud de cancelación enviada. El administrador la revisará pronto.');
                // Recargamos la lista de pedidos pendientes
                cargarPedidos('1');
            // Si el servidor reporta algún fallo
            } else {
                // Escribimos la causa del error en el modal y habilitamos de nuevo el botón
                errorEl.textContent = (data.msg || 'Error desconocido');
                errorEl.classList.remove('hidden');
                btnConf.disabled = false;
                btnConf.textContent = 'Enviar solicitud';
            }
        } catch (e) {
            // En caso de fallar la comunicación de red, lo reportamos y habilitamos el botón
            errorEl.textContent = 'Error de red. Intenta de nuevo.';
            errorEl.classList.remove('hidden');
            btnConf.disabled = false;
            btnConf.textContent = 'Enviar solicitud';
        }
    });
}

// Definimos una función para mostrar notificaciones flotantes temporales en la parte inferior
function mostrarNotificacion(msg) {
    // Creamos la caja del aviso flotante
    const n = document.createElement('div');
    n.className = 'notificacion__toast';
    n.textContent = msg;
    // La agregamos al body de la página
    document.body.appendChild(n);
    // Esperamos un instante antes de hacerla visible con transiciones CSS
    setTimeout(() => n.classList.add('notificacion__toast--visible'), 50);
    // Configuramos un temporizador para desvanecer y remover el aviso de la página tras 3.5 segundos
    setTimeout(() => { n.classList.remove('notificacion__toast--visible'); setTimeout(() => n.remove(), 400); }, 3500);
}

// ═════════════════════════════════════════════════════════════════════════════
// DEVOLUCIÓN — Formulario modal
// ═════════════════════════════════════════════════════════════════════════════

// Definimos una función asíncrona para abrir el modal del formulario de devolución
async function abrirFormDevolucion(idPedido, fechaPedido) {
    // Remover modal previo si existe
    const previo = document.getElementById('devOverlay');
    if (previo) previo.remove();

    // Descargamos el diseño visual del modal de devolución
    const responseTemplate = await fetch('/KurmiProyect/components/modalDevolucionPedido.html');
    const templateHTML = await responseTemplate.text();

    // Creamos el contenedor del modal
    const overlay = document.createElement('div');
    overlay.id = 'devOverlay';
    overlay.className = 'modal__overlay';
    // Le inyectamos el HTML descargado
    overlay.innerHTML = templateHTML;
    document.body.appendChild(overlay);

    // Escribimos la información de la fecha del pedido y el plazo de devolución en el encabezado
    overlay.querySelector('#devFecha').textContent =
        `Pedido del ${fechaPedido} · Tienes 24 horas para solicitar devoluciones.`;

    // Contador de caracteres
    // Buscamos la caja de texto del motivo de devolución y el contador
    const textArea   = document.getElementById('devMotivo');
    const contador   = document.getElementById('devContador');
    // Escuchamos cuando escribe para actualizar en vivo el total de letras ingresadas
    textArea.addEventListener('input', () => {
        contador.textContent = textArea.value.length;
    });

    // Vista previa de imagen
    // Buscamos los inputs de selección de imagen, nombre de archivo, visualizador de vista previa y contenedores
    const inputImg    = document.getElementById('devImagen');
    const fileName    = document.getElementById('devFileName');
    const previewWrap = document.getElementById('devPreviewWrap');
    const preview     = document.getElementById('devPreview');
    const removeBtn   = document.getElementById('devRemoveImg');
    const uploadWrap  = document.getElementById('devUploadWrap');

    // Escuchamos cuando el usuario selecciona una imagen de prueba
    inputImg.addEventListener('change', () => {
        // Obtenemos el archivo de imagen seleccionado
        const file = inputImg.files[0];
        // Si no seleccionó nada, cancelamos
        if (!file) return;
        // Escribimos el nombre del archivo en la pantalla
        fileName.textContent = file.name;
        // Creamos un lector de archivos en memoria
        const reader = new FileReader();
        // Escuchamos cuando termine de leer la imagen
        reader.onload = e => {
            // Le cargamos la imagen en formato base64 al visualizador
            preview.src = e.target.result;
            // Mostramos la caja de vista previa
            previewWrap.style.display = 'flex';
            // Ocultamos el botón original de subida
            uploadWrap.style.display  = 'none';
        };
        // Iniciamos la lectura de la imagen seleccionada
        reader.readAsDataURL(file);
    });

    // Escuchamos el clic en el botón de remover la imagen de prueba seleccionada
    removeBtn.addEventListener('click', () => {
        // Vaciamos el input de archivo
        inputImg.value = '';
        // Escribimos el texto por defecto
        fileName.textContent = 'Sin archivo seleccionado';
        // Ocultamos la vista previa
        previewWrap.style.display = 'none';
        // Mostramos el botón de subida nuevamente
        uploadWrap.style.display  = 'flex';
    });

    // Cerrar modal
    // Definimos una función interna para remover el modal
    const cerrar = () => overlay.remove();
    // Escuchamos el botón de cerrar en la X
    document.getElementById('devCerrar').addEventListener('click', cerrar);
    // Escuchamos el botón de cancelar
    document.getElementById('devBtnCancelar').addEventListener('click', cerrar);
    // Escuchamos el clic en el fondo oscuro
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

    // Enviar formulario
    // Escuchamos el clic en el botón de enviar solicitud de devolución
    document.getElementById('devBtnEnviar').addEventListener('click', () => {
        // Llamamos a la función encargada del envío de los datos
        enviarDevolucion(idPedido, overlay);
    });
}

// Definimos una función asíncrona para enviar los datos de la devolución al servidor
async function enviarDevolucion(idPedido, overlay) {
    // Buscamos la caja de texto del motivo, el archivo de imagen, la etiqueta de error y el botón de enviar
    const motivo   = document.getElementById('devMotivo').value.trim();
    const inputImg = document.getElementById('devImagen');
    const errorEl  = document.getElementById('devError');
    const btnEnviar = document.getElementById('devBtnEnviar');

    // Ocultamos el mensaje de error previo y lo vaciamos
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    // Si el usuario no escribió un motivo explicativo
    if (!motivo) {
        // Mostramos el error pidiendo escribir el motivo
        errorEl.textContent = 'Por favor escribe el motivo de la devolución.';
        errorEl.classList.remove('hidden');
        return;
    }

    // Desactivamos el botón de enviar para evitar duplicados
    btnEnviar.disabled = true;
    // Cambiamos el texto a "Enviando..."
    btnEnviar.textContent = 'Enviando…';

    // Creamos un objeto de tipo FormData para permitir la subida del archivo de imagen
    const formData = new FormData();
    // Agregamos la acción de creación
    formData.append('accion', 'crearDevolucion');
    // Agregamos el ID del pedido
    formData.append('idPedido', idPedido);
    // Agregamos el motivo
    formData.append('motivo', motivo);
    // Si el usuario seleccionó un archivo de imagen
    if (inputImg.files[0]) {
        // Adjuntamos el archivo bajo el parámetro 'imagenPrueba'
        formData.append('imagenPrueba', inputImg.files[0]);
    }

    try {
        // Enviamos la petición POST multipart al Servlet de Devoluciones del servidor
        const res  = await fetch('/KurmiProyect/DevolucionServlet', {
            method: 'POST',
            body: formData
        });
        // Convertimos la respuesta obtenida a formato JSON
        const data = await res.json();

        // Si el servidor confirma la recepción y registro correcto de la solicitud
        if (data.ok) {
            // Quitamos el modal de la pantalla
            overlay.remove();
            // Mostramos un mensaje flotante de confirmación de éxito al cliente
            mostrarToast('Solicitud de devolución enviada correctamente');
            // Se cierra también el modal de detalle del pedido (si estaba abierto detrás del
            // formulario de devolución), porque sigue mostrando los productos con los datos
            // viejos (botón activo, sin tieneDevolucion). Forzar su cierre evita que el cliente
            // vea el producto todavía "disponible para devolver" justo después de solicitarla;
            // al volver a abrir el pedido, el modal se reconstruye con datos frescos del server.
            const modalDetalle = document.getElementById('modalOverlay');
            if (modalDetalle) modalDetalle.classList.add('hidden');
            // Recargar la pestaña de entregados para reflejar el cambio de estado
            cargarPedidos('8');
        // Si el servidor reporta algún fallo
        } else {
            // Pintamos el error en el modal y rehabilitamos el botón de enviar
            errorEl.textContent = data.error || 'No se pudo enviar la solicitud.';
            errorEl.classList.remove('hidden');
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }
    } catch (e) {
        // En caso de un fallo de red o del servidor, lo informamos
        console.error('Error al enviar devolución:', e);
        errorEl.textContent = 'Error de red. Intenta de nuevo.';
        errorEl.classList.remove('hidden');
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar solicitud';
    }
}

// ── Toast de notificación ─────────────────────────────────────────────────────
// Definimos una función para mostrar avisos tipo Toast en pantalla para devoluciones
function mostrarToast(mensaje) {
    // Creamos la caja del aviso
    const toast = document.createElement('div');
    toast.className = 'dev__toast';
    toast.textContent = mensaje;
    // Lo metemos en la página
    document.body.appendChild(toast);
    // Esperamos un momento y activamos la animación visual CSS
    setTimeout(() => toast.classList.add('dev__toast--visible'), 50);
    // Configuramos el temporizador para desvanecer y remover la etiqueta tras 3.5 segundos
    setTimeout(() => {
        toast.classList.remove('dev__toast--visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ═════════════════════════════════════════════════════════════════════════════
// MIS DEVOLUCIONES — Apartado del cliente
// ═════════════════════════════════════════════════════════════════════════════

// Definimos una función asíncrona para cargar las devoluciones activas enviadas por el cliente
async function cargarMisDevoluciones() {
    // Buscamos el contenedor de pedidos en la página
    const grid = document.getElementById('pedidosGrid');
    // Mostramos un mensaje de cargando solicitudes en la pantalla
    mostrarMensajeEstado(grid, 'pedidos__cargando', 'Cargando solicitudes…');

    try {
        // Hacemos una consulta fetch al Servlet solicitando la lista de devoluciones del usuario logueado
        const res  = await fetch('/KurmiProyect/DevolucionServlet?accion=misDevoluciones');
        // Si no está autenticado, redirigimos al inicio de sesión
        if (res.status === 401) { window.location.replace('/KurmiProyect/inicioSesion.html'); return; }
        // Si no cuenta con permisos
        if (res.status === 403) { 
            alert(' No tienes permisos para acceder a esta sección.');
            return; 
        }
        // Convertimos la respuesta obtenida a JSON
        const data = await res.json();

        // Limpiamos el grid en la página
        grid.innerHTML = '';

        // Si la consulta falló o el listado de devoluciones está vacío
        if (!data.ok || !data.devoluciones || data.devoluciones.length === 0) {
            // Mostramos un mensaje indicando que aún no hay solicitudes
            mostrarMensajeEstado(grid, 'pedidos__vacio', ':( Aún no has enviado solicitudes de devolución.');
            return;
        }

        // Recorremos cada una de las devoluciones de la lista
        for (const dev of data.devoluciones) {
            // Creamos asíncronamente la tarjeta visual de la devolución
            const card = await crearTarjetaDevolucion(dev);
            // La agregamos a la cuadrícula en la pantalla
            grid.appendChild(card);
        }

    } catch (e) {
        // Registramos el error en consola y mostramos un mensaje visual de error
        console.error('Error cargando devoluciones:', e);
        mostrarMensajeEstado(grid, 'pedidos__vacio', 'Error al cargar solicitudes.');
    }
}

// Creamos un objeto global en memoria para guardar la plantilla de la tarjeta de devolución
let plantillaTarjetaDevolucion = null;

// Definimos una función asíncrona para armar y configurar la tarjeta visual de una devolución
async function crearTarjetaDevolucion(dev) {
    // Configuramos colores e iconos para el badge visual según el estado de la solicitud (Pendiente, Aprobada, Rechazada)
    const cfgEstado = {
        'Pendiente': { bg: '#e67e22', color: '#fff', icon: '...' },
        'Aprobada':  { bg: '#2ecc71', color: '#fff', icon: ':)' },
        'Rechazada': { bg: '#e74c3c', color: '#fff', icon: ':(' }
    };
    const cfg = cfgEstado[dev.estado] || { bg: '#aaa', color: '#fff', icon: '?' };

    // Definimos la ruta base para las imágenes en el servidor
    const BASE_IMG = '/KurmiProyect/RESOURCES/img/';

    // Bug fix 1: mostrar imagen del primer producto del pedido, no imagenPrueba
    // Determinamos la imagen del producto, usando la genérica si no tiene
    const imgSrc = (dev.imagenPrimera && dev.imagenPrimera !== 'inicioHelado.png')
        ? BASE_IMG + dev.imagenPrimera
        : '../../RESOURCES/img/inicioHelado.png';

    // Cargar la plantilla una sola vez
    // Si no está descargada la plantilla en la memoria
    if (!plantillaTarjetaDevolucion) {
        // Hacemos fetch al componente visual tarjetaDevolucion.html
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaDevolucion.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        // Extraemos y guardamos la tarjeta en la plantilla global
        plantillaTarjetaDevolucion = docTemplate.querySelector('.pedido__card');
    }

    // Clonamos la tarjeta a partir de la plantilla
    const card = plantillaTarjetaDevolucion.cloneNode(true);
    // Cambiamos el cursor a tipo puntero al pasar el mouse por encima
    card.style.cursor = 'pointer';

    // Buscamos el elemento de imagen de la tarjeta y le asignamos la imagen correspondiente
    const img = card.querySelector('img.pedido__img');
    img.src = imgSrc;
    // Si la imagen falla al cargar, mostramos la genérica por defecto
    img.onerror = () => { img.src = '../../RESOURCES/img/inicioHelado.png'; };

    // Escribimos la fecha recortada del pedido original (AAAA-MM-DD)
    card.querySelector('#devCardFecha').textContent =
        `Pedido del ${dev.fechaPedido ? dev.fechaPedido.substring(0, 10) : ''}`;

    // Buscamos y configuramos el badge de estado en la tarjeta de devolución
    const badge = card.querySelector('#devCardEstadoBadge');
    badge.textContent = `${cfg.icon} ${dev.estado}`;
    badge.style.background = cfg.bg;
    badge.style.color = cfg.color;

    // Rellenamos el motivo escrito por el cliente
    card.querySelector('#devCardMotivo').textContent = dev.motivo;
    // Rellenamos el total de la compra formateado
    card.querySelector('#devCardTotal').textContent =
        `Total pedido: $${Number(dev.totalPago).toLocaleString('es-CO')}`;

    // Si la solicitud ya fue respondida con una justificación del administrador
    if (dev.motivoRespuesta) {
        // Buscamos el bloque de respuesta en la tarjeta
        const bloqueResp = card.querySelector('#devCardMotivoResp');
        // Quitamos la clase 'hidden' para mostrarlo
        bloqueResp.classList.remove('hidden');
        // Escribimos el motivo de la respuesta de rechazo o aprobación
        card.querySelector('#devCardMotivoRespTexto').textContent = dev.motivoRespuesta;
    }

    // Armamos el texto con la fecha de la solicitud enviada
    let textoSolicitud = `Solicitud enviada: ${dev.fechaSolicitud ? dev.fechaSolicitud.substring(0, 10) : ''}`;
    // Si ya cuenta con fecha de respuesta
    if (dev.fechaRespuesta) {
        // Le agregamos la fecha de respuesta al texto descriptivo
        textoSolicitud += ` · Respondida: ${dev.fechaRespuesta.substring(0, 10)}`;
    }
    // Escribimos la fecha de la solicitud en la tarjeta
    card.querySelector('#devCardFechaSolicitud').textContent = textoSolicitud;

    // Bug fix 2: click abre el modal con los productos del pedido original
    // Escuchamos el clic sobre la tarjeta de devolución
    card.addEventListener('click', async () => {
        try {
            // Mapeamos el nombre del estado al ID en la base de datos
            let idEstadoNum = '9'; // Por defecto estado Devolución
            // Si el estado es exactamente 'Devolucion Solicitada'
            if (dev.estado === 'Devolucion Solicitada') {
                idEstadoNum = '10'; // ID del script SQL para solicitada
            }

            // Enviamos el ID dinámico al Servlet consultando el listado completo de pedidos
            const res = await fetch(`/KurmiProyect/PedidosServlet?estado=${idEstadoNum}`);
            if (!res.ok) return;

            // Convertimos los pedidos a JSON
            const pedidos = await res.json();
            // Buscamos el pedido original correspondiente a esta devolución
            const pedido  = pedidos.find(p => p.idPedido === dev.idPedido);

            // Abrimos el modal pasándole el pedido obtenido y su estado
            if (pedido) abrirModal(pedido, idEstadoNum);
        } catch (e) {
            // Registramos el error de red en consola si falla
            console.error('Error al abrir detalle de devolución:', e);
        }
    });
    

    // Devolvemos la tarjeta configurada
    return card;
}

// ── Modal (detalle de pedido — sin cambios) ───────────────────────────────────
// Definimos una función para abrir el modal del detalle completo de un pedido seleccionado
function abrirModal(pedido, filtroActivo) {
    // Buscamos las etiquetas principales del modal en el HTML (fondo, título, fecha, badge, lista de productos y pie de página)
    const overlay    = document.getElementById('modalOverlay');
    const titulo     = document.getElementById('modalTitulo');
    const fecha      = document.getElementById('modalFecha');
    const badgeEl    = document.getElementById('modalEstadoBadge');
    const productos  = document.getElementById('modalProductos');
    const footer     = document.getElementById('modalFooter');

    // Mapeamos los títulos del modal de acuerdo a la pestaña activa en la página
    const etiquetasTitulo = {
        '1':          'Pedido Pendiente',
        'en_proceso': 'Pedido En Proceso',
        '8':          'Pedido Entregado',
        '9':          'Devolución',
        '3':          'Pedido Cancelado'
    };
    titulo.textContent = etiquetasTitulo[filtroActivo] || 'Detalle del pedido';
    // Escribimos la fecha y el método de pago del pedido en el subtítulo
    fecha.textContent  = 'Fecha: ' + (pedido.fechaPedido || '') +
                         '  ·  Pago: ' + (pedido.metodoPago || 'No registrado');

    // Vaciamos la etiqueta de badge
    badgeEl.innerHTML = '';
    // Si el pedido tiene nombre de estado asignado
    if (pedido.nombreEstado) {
        // Obtenemos los colores para pintar el estado
        const cfg = estadoBadgeConfig(pedido.estadoPedido);
        // Creamos un span en memoria
        const span = document.createElement('span');
        span.className = 'modal__estado-badge';
        span.textContent = pedido.nombreEstado;
        span.style.background = cfg.bg;
        span.style.color = cfg.color;
        // Metemos el span de estado en la caja del badge
        badgeEl.appendChild(span);
    }

    // Limpiamos los productos y footer anteriores del modal
    productos.innerHTML = '';
    footer.innerHTML    = '';

    // Lista de productos del pedido (plana, sin separación por proveedor)
    // Agrupamos todos los productos en un solo arreglo plano
    const todosLosProductos = (pedido.subpedidos && pedido.subpedidos.length > 0)
        ? pedido.subpedidos.flatMap(sub => sub.productos || [])
        : (pedido.productos || []);

    // Recorremos cada producto de la lista
    todosLosProductos.forEach(prod => {
        // Creamos la caja div para la tarjeta de producto dentro del modal
        const card = document.createElement('div');
        card.className = 'modal__prod-card';

        // Creamos la etiqueta de imagen
        const img = document.createElement('img');
        img.className = 'modal__prod-img';
        const BASE_IMG_MOD = '/KurmiProyect/RESOURCES/img/';
        // Le asignamos la imagen del producto, usando la de por defecto si está vacía
        img.src = (prod.imagen && prod.imagen !== 'inicioHelado.png')
            ? BASE_IMG_MOD + prod.imagen
            : '../../RESOURCES/img/inicioHelado.png';
        img.alt = prod.nombre;

        // Creamos la caja div para el texto del producto
        const info = document.createElement('div');
        info.className = 'modal__prod-info';

        // Creamos un párrafo para el nombre del producto
        const nombre = document.createElement('p');
        nombre.className = 'modal__prod-nombre';
        nombre.textContent = prod.nombre;

        // Creamos un párrafo para mostrar la cantidad y el subtotal de compra
        const det = document.createElement('p');
        det.className = 'modal__prod-detalle';
        det.textContent = 'Cantidad: ' + prod.cantidad + '  ·  $' + Number(prod.precioTotal).toLocaleString('es-CO');

        // Metemos el nombre y los detalles de cantidad al contenedor de info
        info.appendChild(nombre);
        info.appendChild(det);
        // Metemos la imagen y la info en la tarjeta del producto
        card.appendChild(img);
        card.appendChild(info);

        // Botón de devolución por producto — solo en pedidos Entregados (8), dentro de las
        // primeras 24 horas desde la compra, sobre el sub-pedido (proveedor) específico de
        // ESTE producto, y solo si ese sub-pedido todavía no tiene una devolución en curso.
        // Si el filtro activo es el de Entregados y el producto cuenta con ID de subpedido
        if (filtroActivo === '8' && prod.idPedido) {
            // Obtenemos la fecha del pedido
            const fechaRaw     = pedido.fechaPedidoCompleta || pedido.fechaPedido;
            const fechaEntrega = new Date(fechaRaw.replace(' ', 'T'));
            const ahora        = new Date();
            // Calculamos las horas transcurridas
            const diffHoras    = (ahora - fechaEntrega) / (1000 * 60 * 60);

            // Si está dentro de las 24 horas y el producto no se ha solicitado para devolución
            if (diffHoras <= 24 && !prod.tieneDevolucion) {
                // Creamos un botón para solicitar la devolución individual del producto
                const btnDevolverProd = document.createElement('button');
                btnDevolverProd.className = 'btn__pedido-devolver btn__modal-prod-devolver';
                btnDevolverProd.textContent = 'Solicitar devolución';
                // Escuchamos el clic en el botón de devolución individual
                btnDevolverProd.addEventListener('click', e => {
                    e.stopPropagation();
                    // Abrimos el formulario modal de devolución correspondiente a este subpedido de proveedor
                    abrirFormDevolucion(prod.idPedido, pedido.fechaPedido);
                });
                // Metemos el botón de devolución en la info del producto
                info.appendChild(btnDevolverProd);
            }
        }

        // Agregamos la tarjeta del producto al listado en el modal
        productos.appendChild(card);
    });

    // Se calcula sumando los precioTotal de los productos reales mostrados en el modal.
    // Usar pedido.totalPago puede ser solo el subtotal de un proveedor cuando la compra
    // tiene varios proveedores pero la BD guarda un pedido por proveedor.
    // Calculamos el valor final sumando los subtotales de la lista
    const totalCalculado = todosLosProductos.reduce((acc, p) => acc + Number(p.precioTotal || 0), 0);
    // Creamos un párrafo para el texto del total
    const spanTotal = document.createElement('p');
    spanTotal.className = 'modal__total-texto';
    spanTotal.textContent = 'Total: $' + totalCalculado.toLocaleString('es-CO');
    // Metemos el total en el pie de página del modal
    footer.appendChild(spanTotal);

    // Botón recomprar — solo en Cancelado (3)
    // Si la pestaña actual activa es la de pedidos Cancelados
    if (filtroActivo === '3') {
        // Creamos un selector desplegable en memoria para que seleccione el método de pago
        const selectMetodo = document.createElement('select');
        selectMetodo.id = 'selectMetodoRecompra';

        // Creamos la opción por defecto deshabilitada
        const opcionDefault = document.createElement('option');
        opcionDefault.value = '';
        opcionDefault.disabled = true;
        opcionDefault.selected = true;
        opcionDefault.textContent = 'Método de pago';

        // Creamos la opción de efectivo
        const opcionEfectivo = document.createElement('option');
        opcionEfectivo.value = '1';
        opcionEfectivo.textContent = 'Efectivo';

        // Creamos la opción de nequi
        const opcionNequi = document.createElement('option');
        opcionNequi.value = '2';
        opcionNequi.textContent = 'Nequi';

        // Insertamos todas las opciones en el selector
        selectMetodo.appendChild(opcionDefault);
        selectMetodo.appendChild(opcionEfectivo);
        selectMetodo.appendChild(opcionNequi);

        // Creamos un botón para confirmar la recompra
        const btnRecomprar = document.createElement('button');
        btnRecomprar.className = 'btn__modal-comprar';
        btnRecomprar.textContent = 'Comprar nuevamente';
        // Escuchamos el clic en el botón de recomprar
        btnRecomprar.onclick = () => {
            // Obtenemos el método de pago seleccionado
            const idMetodo = selectMetodo.value;
            // Si no seleccionó ningún método, le pedimos hacerlo y cancelamos
            if (!idMetodo) { alert('Selecciona un método de pago.'); return; }
            // Llamamos a la función asíncrona encargada de reactivar la orden
            recomprarPedido(pedido.idPedido, parseInt(idMetodo));
        };

        // Metemos el selector y el botón de recompra al final del modal
        footer.appendChild(selectMetodo);
        footer.appendChild(btnRecomprar);
    }

    // Hacemos visible el modal de detalles removiendo la clase 'hidden'
    overlay.classList.remove('hidden');
}

// ── Recomprar ─────────────────────────────────────────────────────────────────
// Definimos una función asíncrona para reactivar un pedido cancelado previamente
async function recomprarPedido(idPedido, idMetodo) {
    try {
        // Enviamos una petición POST al servlet con la orden de cambiar el estado a 1 (Pendiente) y pasar el método de pago
        const res = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'idPedido=' + encodeURIComponent(idPedido) +
                  '&nuevoEstado=1' +
                  '&idMetodo=' + encodeURIComponent(idMetodo)
        });
        // Convertimos la respuesta a JSON
        const data = await res.json();
        // Si el servidor confirma la reactivación correcta de la orden
        if (data.ok) {
            // Alertamos al usuario indicando el éxito
            alert('¡Pedido reactivado! Ya aparece en Pendientes.');
            // Ocultamos el modal agregando la clase 'hidden'
            document.getElementById('modalOverlay').classList.add('hidden');
            // Recargamos la pestaña actual de pedidos cancelados
            cargarPedidos('3');
        // Si el servidor falla
        } else {
            // Mostramos la causa del error devuelto
            alert('No se pudo reactivar: ' + (data.msg || 'error desconocido'));
        }
    } catch (e) {
        // En caso de fallar la comunicación por red
        console.error('Error al reactivar pedido:', e);
        alert('Error de red al reactivar el pedido.');
    }
}

// ── Cerrar modal ──────────────────────────────────────────────────────────────
// Buscamos el botón de la X para cerrar el modal
document.getElementById('modalCerrar').addEventListener('click', () => {
    // Escondemos el modal agregando la clase 'hidden'
    document.getElementById('modalOverlay').classList.add('hidden');
});
// Escuchamos el clic en toda el área del modal
document.getElementById('modalOverlay').addEventListener('click', e => {
    // Si el usuario hace clic exactamente en el fondo translúcido del modal (y no en su caja de contenido)
    if (e.target === e.currentTarget) {
        // Ocultamos el modal añadiendo la clase 'hidden'
        e.currentTarget.classList.add('hidden');
    }
});