// Se importa la función "components" desde el helper compartido del proyecto;
// esta función se usa más abajo para inyectar fragmentos HTML reutilizables (header y footer).
import { components } from '../../helpers/index.js';

async function cargarModulos() {
    // Paso 1: Carga los componentes visuales repetitivos de la página
    // Se cargan en paralelo (Promise.all) el header y el footer, inyectándolos en sus
    // respectivos contenedores antes de seguir con el resto de la inicialización.
    await Promise.all([
        components('header', '../../components/header.html'),
        components('footer', '../../components/footer.html')
    ]);
    // Paso 2: Invoca al guardián de seguridad del Frontend
    // Se llama a verificarSesion(), que consulta al servidor si el usuario tiene sesión activa.
    const tieneSesion = await verificarSesion();
    // Paso 3: ¡El freno de mano! Si verificarSesion devolvió 'false', detiene todo.
    // Se corta la ejecución de cargarModulos() si no hay sesión, ya que verificarSesion()
    // ya se encargó de redirigir al usuario a la pantalla de inicio de sesión.
    if (!tieneSesion) return;
    // Paso 4: Si todo está en orden, inicializa la página normalmente
    // Se activan los botones de filtro (pestañas) de la vista de pedidos.
    inicializarFiltros();
    // Se realiza la primera carga de pedidos, mostrando por defecto la pestaña "Pendientes" (estado '1').
    cargarPedidos('1'); // Inicia cargando la pestaña de "Pendientes"
}
// Se ejecuta cargarModulos() inmediatamente al cargar el script, arrancando toda la página.
cargarModulos();

// ── Verificar sesión ──────────────────────────────────────────────────────────
async function verificarSesion() {
    try {
        // 1. Toca la puerta del servidor en el PerfilServlet
        // Se hace una petición GET al PerfilServlet, que es el endpoint encargado de
        // devolver los datos del usuario autenticado actual.
        const res = await fetch('/KurmiProyect/PerfilServlet');
        // 2. El AuthHelper de Java respondió con un 401 Unauthorized
        // Se valida si la respuesta fue 401 (no autenticado) o 403 (sin permisos);
        // en ambos casos se redirige al login y se devuelve false para detener la carga de la página.
        if (res.status === 401 ||res.status === 403 ) { window.location.replace('/KurmiProyect/inicioSesion.html'); return false; }
        // 3. Si no fue 401, significa que sí hay sesión. Extrae los datos del UsuarioDTO
        // Se convierte la respuesta a JSON para obtener el objeto del usuario logueado.
        const usuario = await res.json();
        // 4. Busca el elemento HTML y le pinta el nombre real del usuario logueado (ej: Eileen)
        // Se busca el elemento con id "nombreUsuario" en el header ya cargado.
        const span = document.getElementById('nombreUsuario');
        // Se asigna el nombre del usuario al span, si el elemento existe en el DOM.
        if (span) span.textContent = usuario.nombres || '';
        // Se confirma que hay sesión válida, devolviendo true.
        return true;// Le da luz verde a cargarModulos()
    } catch (e) {
        // Si el servidor está caído o hay un error de red catastrófico, también lo bota al login
        // Se asume que cualquier error de red equivale a no tener sesión válida, por seguridad,
        // y se redirige igualmente al login.
        window.location.replace('/KurmiProyect/inicioSesion.html');
        // Se devuelve false para detener la inicialización de la página.
        return false;
    }
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function inicializarFiltros() {
    // Se recorren todos los botones con clase "filtro__btn" (las pestañas: Pendientes,
    // En proceso, Entregados, Devoluciones, Cancelados, etc.) para asignarles su comportamiento.
    document.querySelectorAll('.filtro__btn').forEach(btn => {
        // Se registra un listener de click en cada botón de filtro.
        btn.addEventListener('click', () => {
            // Se quita la clase "activo" de todos los botones, para desmarcar la pestaña anterior.
            document.querySelectorAll('.filtro__btn').forEach(b => b.classList.remove('filtro__btn--activo'));
            // Se marca como activo el botón que el usuario acaba de pulsar.
            btn.classList.add('filtro__btn--activo');

            // Se lee el estado asociado al botón desde su atributo data-estado.
            const estado = btn.dataset.estado;
            // Se evalúa si la pestaña pulsada es la de "devoluciones".
            if (estado === 'devoluciones') {
                // Se llama a la función especializada que carga las solicitudes de devolución del cliente.
                cargarMisDevoluciones();
            } else {
                // Para cualquier otro estado, se cargan los pedidos normales filtrados por ese estado.
                cargarPedidos(estado);
            }
        });
    });
    // Se busca el botón correspondiente al estado "1" (Pendiente) para marcarlo activo por defecto.
    const btnPendiente = document.querySelector('.filtro__btn[data-estado="1"]');
    // Se le agrega la clase activa si el botón existe, dejando la pestaña de Pendientes
    // seleccionada visualmente al entrar a la página.
    if (btnPendiente) btnPendiente.classList.add('filtro__btn--activo');
}

// ── Helpers de mensajes de estado ───────────────────────────────────────────
function mostrarMensajeEstado(grid, clase, texto) {
    // Se limpia el contenido actual del contenedor (grid) antes de mostrar el mensaje.
    grid.innerHTML = '';
    // Se crea un elemento <p> para mostrar el mensaje de estado (cargando, vacío, error, etc.).
    const p = document.createElement('p');
    // Se le asigna la clase CSS recibida por parámetro, que define su estilo visual.
    p.className = clase;
    // Se asigna el texto del mensaje.
    p.textContent = texto;
    // Se inserta el mensaje dentro del contenedor.
    grid.appendChild(p);
}

// ── Cargar pedidos del servidor ───────────────────────────────────────────────
async function cargarPedidos(estado) {
    // Se obtiene la referencia del contenedor donde se pintan las tarjetas de pedidos.
    const grid = document.getElementById('pedidosGrid');
    // Se muestra un mensaje de "Cargando..." mientras se espera la respuesta del servidor.
    mostrarMensajeEstado(grid, 'pedidos__cargando', 'Cargando...');

    try {
        // Para pestañas "1" y "en_proceso" el servidor devuelve todos juntos
        // (estados 1,4,5,6,7 con sub-pedidos por proveedor); filtramos aquí
        // Se normaliza el parámetro de estado: tanto "1" (Pendiente) como "en_proceso"
        // se envían al servidor como "1", porque el PedidoDAO devuelve juntos los pedidos
        // pendientes y en proceso (estados 1,4,5,6,7) agrupados por proveedor.
        const estadoParam = (estado === '1' || estado === 'en_proceso') ? '1' : estado;
        // Se hace la petición GET al PedidosServlet, pasando el estado como query param.
        const res = await fetch('/KurmiProyect/PedidosServlet?estado=' + estadoParam);
        // Se valida si la sesión expiró (401); en ese caso se redirige al login y se corta la función.
        if (res.status === 401) { window.location.replace('/KurmiProyect/inicioSesion.html'); return; }

        // Se parsea la respuesta JSON con la lista de pedidos del usuario.
        let pedidos = await res.json();
        // Se imprime en consola la respuesta cruda del servidor, útil para depuración.
        console.log('Pedidos recibidos del servidor:', JSON.stringify(pedidos, null, 2));
        // Se limpia el contenedor antes de pintar las tarjetas nuevas.
        grid.innerHTML = '';

        // Filtrar por pestaña activa
        // Se filtra en el cliente solo los pedidos cuyo estadoPedido es exactamente 1 (Pendiente),
        // porque el servidor pudo haber devuelto también los que están en proceso.
        if (estado === '1') {
            pedidos = pedidos.filter(p => p.estadoPedido === 1);
        } else if (estado === 'en_proceso') {
            // Se filtran los pedidos cuyo estadoPedido corresponde a alguno de los pasos
            // intermedios del proceso de entrega: Preparando(4), En bodega(5), Empacando(6), Transportando(7).
            pedidos = pedidos.filter(p => [4, 5, 6, 7].includes(p.estadoPedido));
        }

        // Se define un diccionario de etiquetas legibles para cada código de estado/pestaña,
        // usado para construir el mensaje de "no tienes pedidos" cuando la lista está vacía.
        const etiquetas = {
            '1':          'pedidos pendientes',
            'en_proceso': 'pedidos en proceso',
            '11':         'solicitudes de cancelación',
            '8':          'pedidos entregados',
            '9':          'pedidos en devolución',
            '3':          'pedidos cancelados'
        };

        // Se valida si después del filtrado no quedó ningún pedido.
        if (!pedidos || pedidos.length === 0) {
            // Se muestra un mensaje de "vacío" usando la etiqueta correspondiente al estado actual.
            mostrarMensajeEstado(grid, 'pedidos__vacio', `:( No tienes ${etiquetas[estado] || 'pedidos'} aún.`);
            return;
        }

        // Se recorre cada pedido recibido para construir y mostrar su tarjeta visual.
        pedidos.forEach(pedido => {
            // Se construye la tarjeta del pedido, pasándole también la pestaña activa
            // (para saber qué botones mostrar, ej. cancelar, devolver, etc.).
            const card = crearTarjetaPedido(pedido, estado);
            // Se agrega la tarjeta creada al contenedor visible en pantalla.
            grid.appendChild(card);
        });

    } catch (e) {
        // Se captura cualquier error de red o de parseo ocurrido durante la carga.
        console.error('Error cargando pedidos:', e);
        // Se muestra al usuario un mensaje genérico de error.
        mostrarMensajeEstado(grid, 'pedidos__vacio', 'Error al cargar pedidos.');
    }
}

// ── Crear tarjeta de pedido ───────────────────────────────────────────────────
function crearTarjetaPedido(pedido, filtroActivo) {
    // Se crea el contenedor principal (div) de la tarjeta del pedido.
    const card = document.createElement('div');
    // Se le asigna la clase CSS que define su apariencia.
    card.className = 'pedido__card';

    // Se crea el elemento de imagen del pedido (usa la imagen del primer producto).
    const img = document.createElement('img');
    img.className = 'pedido__img';
    // Se define la ruta base donde están almacenadas las imágenes de productos en el servidor.
    const BASE_IMG = '/KurmiProyect/RESOURCES/img/';
    // Se obtiene el nombre de la imagen del primer producto del pedido, enviado por el backend.
    const imgNombre = pedido.imagenPrimera;
    // Se arma la URL final de la imagen: si hay imagen válida (distinta de la genérica
    // "inicioHelado.png") se usa la ruta del servidor; si no, se usa la imagen por defecto local.
    img.src = (imgNombre && imgNombre !== 'inicioHelado.png')
        ? BASE_IMG + imgNombre
        : '../../RESOURCES/img/inicioHelado.png';
    // Se define el texto alternativo de la imagen, por accesibilidad.
    img.alt = 'Pedido';

    // Se crea el contenedor de la información textual del pedido (fecha, estado, total, etc.).
    const info = document.createElement('div');
    info.className = 'pedido__info';

    // Se crea el párrafo que muestra la fecha del pedido.
    const fecha = document.createElement('p');
    fecha.className = 'pedido__fecha';
    // Se arma el texto con la fecha recibida del servidor (o cadena vacía si no viene).
    fecha.textContent = 'Pedido del ' + (pedido.fechaPedido || '');

    // Se obtiene la configuración de color (fondo y texto) correspondiente al estado del pedido.
    const badgeCfg = estadoBadgeConfig(pedido.estadoPedido);
    // Se crea el "badge" (etiqueta visual) que muestra el nombre del estado del pedido.
    const badge = document.createElement('span');
    badge.className = 'pedido__estado-badge';
    // Se asigna el texto del estado tal como lo envía el servidor (ej. "Entregado").
    badge.textContent = pedido.nombreEstado || '';
    // Se aplica el color de fondo definido en la configuración del estado.
    badge.style.background = badgeCfg.bg;
    // Se aplica el color del texto definido en la configuración del estado.
    badge.style.color = badgeCfg.color;

    // Se crea el párrafo que muestra la cantidad total de productos del pedido.
    const detalle = document.createElement('p');
    detalle.className = 'pedido__detalle';
    detalle.textContent = 'Total productos: ' + (pedido.totalProductos || 0);

    // Se calcula el total sumando los precioTotal de todos los productos del pedido.
    // pedido.totalPago puede ser solo el subtotal de un proveedor en compras multi-proveedor.
    // Se determina la lista completa de productos del pedido: si "productos" viene poblado
    // se usa directamente; si no, se aplanan los productos de todos los "subpedidos" (proveedores).
    const todosProds = (pedido.productos && pedido.productos.length > 0)
        ? pedido.productos
        : (pedido.subpedidos || []).flatMap(s => s.productos || []);
    // Se calcula el total real sumando el precioTotal de cada producto encontrado;
    // si no hay productos disponibles, se recurre al totalPago que envía el servidor como respaldo.
    const totalReal = todosProds.length > 0
        ? todosProds.reduce((acc, p) => acc + Number(p.precioTotal || 0), 0)
        : Number(pedido.totalPago);
    // Se crea el párrafo que mostrará el total calculado, con formato de moneda colombiana.
    const total = document.createElement('p');
    total.className = 'pedido__total';
    total.textContent = 'Total: $' + totalReal.toLocaleString('es-CO');

    // Se ensamblan los elementos de información dentro del contenedor "info", en orden.
    info.appendChild(fecha);
    info.appendChild(badge);
    info.appendChild(detalle);
    info.appendChild(total);

    // Los estados de proveedor no se muestran al cliente

    // Se agrega la imagen y la información a la tarjeta principal.
    card.appendChild(img);
    card.appendChild(info);

    // Botón cancelar — solo en Pendiente (1)
    // Se valida que la pestaña activa sea "1" y que el pedido efectivamente esté en estado Pendiente,
    // para decidir si se debe ofrecer la opción de cancelar.
    if (filtroActivo === '1' && pedido.estadoPedido === 1) {
        // Se crea el botón de cancelación.
        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'btn__pedido-cancelar';
        btnCancelar.textContent = 'Cancelar pedido';
        // Se registra el evento click del botón.
        btnCancelar.addEventListener('click', e => {
            // Se detiene la propagación del click para que no dispare también la apertura del modal
            // de detalle (cuyo listener está puesto sobre toda la tarjeta).
            e.stopPropagation();
            // Se abre el flujo de confirmación de cancelación pasando el id del pedido.
            confirmarCancelacion(pedido.idPedido);
        });
        // Se agrega el botón de cancelar a la tarjeta.
        card.appendChild(btnCancelar);
    }

    // Botón devolver — SOLO en Entregado (8) y si no pasó más de 24 horas.
    // Se muestra aquí solo cuando el pedido tiene un único proveedor (un solo sub-pedido),
    // porque en ese caso no hay ambigüedad sobre a cuál sub-pedido aplica la devolución.
    // Cuando hay varios proveedores, el cliente abre el modal y usa el botón
    // de devolución de cada producto individual (cada uno apunta a su propio sub-pedido).
    // Se determina si el pedido corresponde a un solo proveedor: no tiene lista "idsPedidos"
    // o esa lista tiene como máximo un elemento (es decir, un único sub-pedido detrás).
    const esUnSoloProveedor = !pedido.idsPedidos || pedido.idsPedidos.length <= 1;
    // Se valida que la pestaña activa sea "Entregado" (8), que el pedido esté efectivamente
    // entregado, y que se trate de un único proveedor antes de mostrar el botón en la tarjeta.
    if (filtroActivo === '8' && pedido.estadoPedido === 8 && esUnSoloProveedor) {
        // Se usa fechaPedidoCompleta (con hora exacta) para que el cálculo de 24 h sea preciso.
        // Usar solo la fecha recortada (yyyy-MM-dd) forzaría el inicio a medianoche
        // y haría expirar la ventana horas antes de lo que corresponde.
        // Se obtiene la fecha completa (con hora) del pedido, usando como respaldo la fecha simple.
        const fechaRaw     = pedido.fechaPedidoCompleta || pedido.fechaPedido;
        // Se convierte la fecha recibida (formato "yyyy-MM-dd HH:mm:ss") a un objeto Date válido,
        // reemplazando el espacio por una "T" para que el constructor Date lo interprete bien.
        const fechaEntrega = new Date(fechaRaw.replace(' ', 'T'));
        // Se obtiene la fecha y hora actuales del navegador.
        const ahora        = new Date();
        // Se calcula la diferencia en horas entre ahora y la fecha de entrega.
        const diffHoras    = (ahora - fechaEntrega) / (1000 * 60 * 60);

        // Se valida que no hayan pasado más de 24 horas desde la entrega y que el pedido
        // todavía no tenga una devolución registrada, antes de ofrecer el botón.
        if (diffHoras <= 24 && !pedido.tieneDevolucion) {
            // Se crea el botón de "Solicitar devolución".
            const btnDevolver = document.createElement('button');
            btnDevolver.className = 'btn__pedido-devolver';
            btnDevolver.textContent = 'Solicitar devolución';
            // Se registra el evento click del botón de devolución.
            btnDevolver.addEventListener('click', e => {
                // Se evita que el click también dispare la apertura del modal de detalle.
                e.stopPropagation();
                // Se determina el id de pedido (sub-pedido) sobre el cual se debe registrar
                // la devolución: el primero de la lista idsPedidos si existe, o el idPedido directo.
                const idParaDevolucion = (pedido.idsPedidos && pedido.idsPedidos.length > 0)
                    ? pedido.idsPedidos[0]
                    : pedido.idPedido;
                // Se abre el formulario modal de devolución con el id determinado.
                abrirFormDevolucion(idParaDevolucion, pedido.fechaPedido);
            });
            // Se agrega el botón de devolución a la tarjeta.
            card.appendChild(btnDevolver);
        }
    }

    // Botón factura — aparece en TODOS los pedidos sin importar el estado
    // Se crea el botón de "Ver factura", disponible siempre.
    const btnFactura = document.createElement('button');
    btnFactura.className = 'btn__pedido-factura';
    btnFactura.textContent = 'Ver factura';
    // Se registra el evento click del botón de factura.
    btnFactura.addEventListener('click', e => {
        // Se evita que el click propague hacia la apertura del modal de detalle.
        e.stopPropagation();
        // Se genera y abre la factura en formato imprimible para este pedido.
        generarFacturaPDF(pedido);
    });
    // Se agrega el botón de factura a la tarjeta.
    card.appendChild(btnFactura);

    // Se registra el evento click sobre toda la tarjeta para abrir el modal con el detalle
    // completo del pedido (solo se dispara si no fue interceptado por algún botón interno).
    card.addEventListener('click', () => abrirModal(pedido, filtroActivo));
    // Se devuelve la tarjeta ya completamente construida.
    return card;
}

// ── Factura descargable ───────────────────────────────────────────────────────
async function generarFacturaPDF(pedido) {
    // Se obtiene la configuración de color del estado del pedido, para pintar el badge de la factura.
    const badgeCfg  = estadoBadgeConfig(pedido.estadoPedido);
    // Se extraen y normalizan (con valores por defecto "—") los campos que se mostrarán en la factura.
    const estado    = pedido.nombreEstado || '—';
    const fecha     = pedido.fechaPedido  || '—';
    const metodo    = pedido.metodoPago   || 'No registrado';
    // Se formatea el total pagado con separadores de miles en formato colombiano.
    const total     = Number(pedido.totalPago).toLocaleString('es-CO');
    // Se obtiene el nombre del receptor, aceptando dos posibles nombres de propiedad según el origen del dato.
    const receptor  = pedido.receptor  || pedido.nombreReceptor  || '—';
    // Se obtiene la dirección de envío, igualmente con dos posibles nombres de propiedad.
    const direccion = pedido.direccion || pedido.direccionEnvio   || '—';
    // Se obtiene el teléfono de envío, con la misma lógica de respaldo.
    const telefono  = pedido.telefono  || pedido.telefonoEnvio    || '—';

    // Cargar la plantilla de la factura
    // Se solicita al servidor el archivo HTML que sirve de plantilla visual para la factura.
    const responseTemplate = await fetch('/KurmiProyect/components/facturaPedido.html');
    // Se obtiene el contenido HTML como texto plano.
    const templateHTML = await responseTemplate.text();

    // Se abre una nueva ventana del navegador (tipo pop-up) con tamaño fijo, donde se mostrará la factura.
    const ventana = window.open('', '_blank', 'width=800,height=700');
    // Se escribe el HTML de la plantilla directamente dentro del documento de la nueva ventana.
    ventana.document.write(templateHTML);
    // Se cierra el flujo de escritura del documento, indicando que ya terminó de cargarse.
    ventana.document.close();

    // Rellenar contenido dinámico una vez la ventana terminó de cargar
    // Se guarda una referencia corta al documento de la ventana emergente.
    const doc = ventana.document;

    // Se rellena el número de factura: si el pedido agrupa varios sub-pedidos (multi-proveedor)
    // se listan todos sus ids; si es un único pedido, se muestra solo su id.
    doc.getElementById('facturaNumero').textContent = pedido.idsPedidos && pedido.idsPedidos.length > 1
        ? `Pedidos #${pedido.idsPedidos.join(', #')}`
        : `Factura #${pedido.idPedido}`;
    // Se rellena la fecha mostrada en el encabezado de la factura.
    doc.getElementById('facturaFechaHeader').textContent = `Fecha: ${fecha}`;

    // Se obtiene el elemento del badge de estado dentro de la factura.
    const badge = doc.getElementById('facturaEstadoBadge');
    // Se asigna el texto del estado.
    badge.textContent = estado;
    // Se aplican los colores correspondientes al estado del pedido.
    badge.style.background = badgeCfg.bg;
    badge.style.color = badgeCfg.color;

    // Se rellenan los datos de envío y pago en sus respectivos elementos de la plantilla.
    doc.getElementById('facturaReceptor').textContent  = receptor;
    doc.getElementById('facturaDireccion').textContent = direccion;
    doc.getElementById('facturaTelefono').textContent  = telefono;
    doc.getElementById('facturaMetodo').textContent    = metodo;
    doc.getElementById('facturaFechaPago').textContent = fecha;
    doc.getElementById('facturaTotal').textContent     = `$${total}`;

    // Construir las filas de productos sin HTML incrustado
    // Se obtiene el elemento <tbody> donde se insertarán las filas de productos de la factura.
    const tbody = doc.getElementById('facturaFilasProductos');

    // Igual que en el modal de detalle: los productos pueden venir
    // planos en pedido.productos o agrupados por proveedor en pedido.subpedidos
    // Se construye la lista completa de productos, aplanando los subpedidos si es necesario
    // (misma lógica usada también en abrirModal).
    const todosLosProductos = (pedido.subpedidos && pedido.subpedidos.length > 0)
        ? pedido.subpedidos.flatMap(sub => sub.productos || [])
        : (pedido.productos || []);

    // Se recorre cada producto para construir su fila correspondiente en la tabla de la factura.
    todosLosProductos.forEach(p => {
        // Se crea la fila <tr> del producto.
        const tr = doc.createElement('tr');

        // Se crea la celda con el nombre del producto.
        const tdNombre = doc.createElement('td');
        tdNombre.textContent = p.nombre || '—';

        // Se crea la celda con la cantidad comprada del producto.
        const tdCantidad = doc.createElement('td');
        tdCantidad.className = 'col-num';
        tdCantidad.textContent = p.cantidad;

        // Se crea la celda con el precio unitario del producto.
        const tdPrecio = doc.createElement('td');
        tdPrecio.className = 'col-precio';
        // Se calcula el precio unitario: si el servidor ya lo envía se usa directamente;
        // si no, se deriva dividiendo el precioTotal entre la cantidad (evitando división por cero).
        const precioUnit = p.precio != null
            ? Number(p.precio)
            : (p.cantidad ? Number(p.precioTotal || 0) / p.cantidad : 0);
        tdPrecio.textContent = `$${precioUnit.toLocaleString('es-CO')}`;

        // Se crea la celda con el subtotal (precioTotal) de la línea del producto.
        const tdSubtotal = doc.createElement('td');
        tdSubtotal.className = 'col-subtotal';
        tdSubtotal.textContent = `$${Number(p.precioTotal || 0).toLocaleString('es-CO')}`;

        // Se ensamblan las celdas dentro de la fila, en el orden: nombre, cantidad, precio, subtotal.
        tr.appendChild(tdNombre);
        tr.appendChild(tdCantidad);
        tr.appendChild(tdPrecio);
        tr.appendChild(tdSubtotal);
        // Se agrega la fila ya completa al cuerpo de la tabla.
        tbody.appendChild(tr);
    });

    // Botón de imprimir
    // Se busca el botón de impresión dentro de la ventana de la factura.
    const btnImprimir = doc.getElementById('btnImprimirFactura');
    // Se valida que el botón exista en la plantilla antes de engancharle el evento.
    if (btnImprimir) {
        // Se registra el evento click que invoca el diálogo de impresión del navegador
        // sobre la ventana emergente de la factura.
        btnImprimir.addEventListener('click', () => ventana.print());
    }
}

// ── Config de color por estado ────────────────────────────────────────────────
function estadoBadgeConfig(estadoPedido) {
    // Se define un mapa fijo que asocia cada código numérico de estado (igual a los IDs
    // de la tabla EstadoPedido) con su color de fondo y de texto correspondiente.
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
    // Se devuelve la configuración del estado recibido; si el estado no existe en el mapa,
    // se devuelve un color gris neutro por defecto.
    return configs[estadoPedido] || { bg: '#aaa', color: '#fff' };
}

// ── Cancelar pedido — Modal con motivo ────────────────────────────────────────
async function confirmarCancelacion(idPedido) {
    // Eliminar modal previo si existe
    // Se busca si ya existe un modal de cancelación abierto previamente en el DOM.
    const previo = document.getElementById('modalCancelacionOverlay');
    // Se elimina el modal anterior para evitar duplicados antes de crear uno nuevo.
    if (previo) previo.remove();

    // Se solicita al servidor la plantilla HTML del modal de cancelación.
    const responseTemplate = await fetch('/KurmiProyect/components/modalCancelacionPedido.html');
    // Se obtiene el contenido de la plantilla como texto.
    const templateHTML = await responseTemplate.text();

    // Se crea el contenedor overlay que actuará como fondo oscuro del modal.
    const overlay = document.createElement('div');
    overlay.id = 'modalCancelacionOverlay';
    overlay.className = 'modal__overlay';
    // Se inyecta el HTML de la plantilla dentro del overlay.
    overlay.innerHTML = templateHTML;
    // Se agrega el overlay al final del body, haciéndolo visible en pantalla.
    document.body.appendChild(overlay);

    // Se rellena el subtítulo del modal indicando el número de pedido a cancelar.
    overlay.querySelector('#cancelSubtitulo').textContent =
        `Pedido #${idPedido} — indica el motivo de la cancelación.`;

    // Se obtienen las referencias a los elementos interactivos del modal: textarea de motivo,
    // contador de caracteres, mensaje de error y botón de confirmar.
    const textarea  = document.getElementById('cancelMotivo');
    const contador  = document.getElementById('cancelContador');
    const errorEl   = document.getElementById('cancelError');
    const btnConf   = document.getElementById('cancelBtnConfirmar');

    // Se define una función auxiliar reutilizable que elimina el overlay (cierra el modal).
    const cerrar = () => overlay.remove();

    // Se registra el evento input del textarea para actualizar en vivo el contador de caracteres.
    textarea.addEventListener('input', () => {
        contador.textContent = textarea.value.length;
    });

    // Se registran los listeners de los botones de cerrar y volver, ambos cierran el modal.
    document.getElementById('cancelModalCerrar').addEventListener('click', cerrar);
    document.getElementById('cancelBtnVolver').addEventListener('click', cerrar);
    // Se permite cerrar el modal haciendo click fuera del contenido (sobre el fondo oscuro).
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

    // Se registra el evento click del botón de confirmar cancelación.
    btnConf.addEventListener('click', async () => {
        // Se obtiene el texto del motivo, eliminando espacios sobrantes al inicio y final.
        const motivo = textarea.value.trim();
        // Se valida que el motivo no esté vacío antes de continuar.
        if (!motivo) {
            // Se muestra un mensaje de error pidiendo que se complete el motivo.
            errorEl.textContent = '⚠ Por favor escribe el motivo antes de continuar.';
            errorEl.classList.remove('hidden');
            return;
        }

        // Se deshabilita el botón y se cambia su texto para evitar doble envío mientras se procesa.
        btnConf.disabled = true;
        btnConf.textContent = 'Enviando…';
        // Se oculta cualquier mensaje de error previo.
        errorEl.classList.add('hidden');

        try {
            // Se envía la solicitud de cancelación al servidor mediante POST, con los datos
            // codificados como formulario (idPedido, nuevoEstado=3 que es "Cancelado", y el motivo).
            const res = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'idPedido=' + encodeURIComponent(idPedido) +
                      '&nuevoEstado=3' +
                      '&motivo=' + encodeURIComponent(motivo)
            });
            // Se parsea la respuesta JSON del servidor.
            const data = await res.json();
            // Se valida si la operación fue exitosa según el flag "ok" devuelto por el servidor.
            if (data.ok) {
                // Se cierra el modal de cancelación.
                cerrar();
                // Se muestra una notificación temporal confirmando el envío de la solicitud.
                mostrarNotificacion('Solicitud enviada. El administrador la revisará pronto.');
                // Se recarga la pestaña de Pendientes para reflejar el cambio de estado del pedido.
                cargarPedidos('1');
            } else {
                // Se muestra el mensaje de error devuelto por el servidor, o uno genérico si no viene.
                errorEl.textContent = (data.msg || 'Error desconocido');
                errorEl.classList.remove('hidden');
                // Se reactiva el botón para permitir un nuevo intento.
                btnConf.disabled = false;
                btnConf.textContent = 'Enviar solicitud';
            }
        } catch (e) {
            // Se captura cualquier error de red durante el envío de la cancelación.
            errorEl.textContent = 'Error de red. Intenta de nuevo.';
            errorEl.classList.remove('hidden');
            // Se reactiva el botón de confirmar tras el fallo.
            btnConf.disabled = false;
            btnConf.textContent = 'Enviar solicitud';
        }
    });
}

function mostrarNotificacion(msg) {
    // Se crea el elemento que actuará como notificación tipo "toast" flotante.
    const n = document.createElement('div');
    n.className = 'notificacion__toast';
    // Se asigna el mensaje recibido como texto de la notificación.
    n.textContent = msg;
    // Se agrega la notificación al final del body.
    document.body.appendChild(n);
    // Se agrega la clase "visible" tras un pequeño retraso, para permitir que la transición
    // CSS de aparición se ejecute correctamente.
    setTimeout(() => n.classList.add('notificacion__toast--visible'), 50);
    // Se programa, después de 3.5 segundos, quitar la clase visible (animación de salida)
    // y luego eliminar el elemento del DOM por completo.
    setTimeout(() => { n.classList.remove('notificacion__toast--visible'); setTimeout(() => n.remove(), 400); }, 3500);
}

// ═════════════════════════════════════════════════════════════════════════════
// DEVOLUCIÓN — Formulario modal
// ═════════════════════════════════════════════════════════════════════════════

async function abrirFormDevolucion(idPedido, fechaPedido) {
    // Remover modal previo si existe
    // Se busca si ya hay un modal de devolución abierto previamente.
    const previo = document.getElementById('devOverlay');
    // Se elimina el modal anterior, si existía, antes de abrir uno nuevo.
    if (previo) previo.remove();

    // Se solicita al servidor la plantilla HTML del formulario de devolución.
    const responseTemplate = await fetch('/KurmiProyect/components/modalDevolucionPedido.html');
    // Se obtiene el HTML de la plantilla como texto.
    const templateHTML = await responseTemplate.text();

    // Se crea el overlay (fondo oscuro) que contendrá el formulario modal.
    const overlay = document.createElement('div');
    overlay.id = 'devOverlay';
    overlay.className = 'modal__overlay';
    // Se inyecta el HTML de la plantilla dentro del overlay.
    overlay.innerHTML = templateHTML;
    // Se agrega el overlay al body, mostrándolo en pantalla.
    document.body.appendChild(overlay);

    // Se rellena el texto informativo con la fecha del pedido y el recordatorio de las 24 horas.
    overlay.querySelector('#devFecha').textContent =
        `Pedido del ${fechaPedido} · Tienes 24 horas para solicitar devoluciones.`;

    // Contador de caracteres
    // Se obtienen las referencias al textarea del motivo y al elemento contador de caracteres.
    const textArea   = document.getElementById('devMotivo');
    const contador   = document.getElementById('devContador');
    // Se registra el evento input para actualizar el contador en vivo mientras el usuario escribe.
    textArea.addEventListener('input', () => {
        contador.textContent = textArea.value.length;
    });

    // Vista previa de imagen
    // Se obtienen las referencias a los elementos relacionados con la carga de la imagen de prueba:
    // el input de archivo, el nombre de archivo mostrado, el contenedor de previsualización,
    // la imagen de previsualización, el botón de quitar imagen y el contenedor del área de carga.
    const inputImg    = document.getElementById('devImagen');
    const fileName    = document.getElementById('devFileName');
    const previewWrap = document.getElementById('devPreviewWrap');
    const preview     = document.getElementById('devPreview');
    const removeBtn   = document.getElementById('devRemoveImg');
    const uploadWrap  = document.getElementById('devUploadWrap');

    // Se registra el evento change del input de archivo, disparado cuando el usuario selecciona una imagen.
    inputImg.addEventListener('change', () => {
        // Se toma el primer archivo seleccionado.
        const file = inputImg.files[0];
        // Se corta la ejecución si no se seleccionó ningún archivo.
        if (!file) return;
        // Se muestra el nombre del archivo seleccionado.
        fileName.textContent = file.name;
        // Se crea un lector de archivos para generar una vista previa de la imagen.
        const reader = new FileReader();
        // Se define qué pasa cuando el archivo termina de leerse.
        reader.onload = e => {
            // Se asigna el resultado (data URL en base64) como fuente de la imagen de previsualización.
            preview.src = e.target.result;
            // Se muestra el bloque de previsualización.
            previewWrap.style.display = 'flex';
            // Se oculta el bloque original de "subir archivo".
            uploadWrap.style.display  = 'none';
        };
        // Se inicia la lectura del archivo como una URL de datos (base64).
        reader.readAsDataURL(file);
    });

    // Se registra el evento click del botón para quitar la imagen seleccionada.
    removeBtn.addEventListener('click', () => {
        // Se limpia el valor del input de archivo, deseleccionando la imagen.
        inputImg.value = '';
        // Se restaura el texto indicando que no hay archivo seleccionado.
        fileName.textContent = 'Sin archivo seleccionado';
        // Se oculta el bloque de previsualización.
        previewWrap.style.display = 'none';
        // Se vuelve a mostrar el bloque de "subir archivo".
        uploadWrap.style.display  = 'flex';
    });

    // Cerrar modal
    // Se define la función auxiliar que cierra el modal eliminándolo del DOM.
    const cerrar = () => overlay.remove();
    // Se registran los listeners de los botones de cerrar (la "x") y cancelar.
    document.getElementById('devCerrar').addEventListener('click', cerrar);
    document.getElementById('devBtnCancelar').addEventListener('click', cerrar);
    // Se permite cerrar el modal al hacer click fuera del contenido (sobre el fondo).
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

    // Enviar formulario
    // Se registra el evento click del botón de enviar, que dispara el envío real de la devolución.
    document.getElementById('devBtnEnviar').addEventListener('click', () => {
        enviarDevolucion(idPedido, overlay);
    });
}

async function enviarDevolucion(idPedido, overlay) {
    // Se obtiene el motivo escrito por el usuario, sin espacios sobrantes.
    const motivo   = document.getElementById('devMotivo').value.trim();
    // Se obtiene el input de archivo de la imagen de prueba.
    const inputImg = document.getElementById('devImagen');
    // Se obtienen los elementos de mensaje de error y el botón de enviar.
    const errorEl  = document.getElementById('devError');
    const btnEnviar = document.getElementById('devBtnEnviar');

    // Se ocultan y limpian mensajes de error previos antes de un nuevo intento de envío.
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    // Se valida que el motivo no esté vacío.
    if (!motivo) {
        // Se muestra el mensaje de error pidiendo completar el motivo.
        errorEl.textContent = 'Por favor escribe el motivo de la devolución.';
        errorEl.classList.remove('hidden');
        return;
    }

    // Se deshabilita el botón de enviar y se cambia su texto para evitar envíos duplicados.
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando…';

    // Se construye un objeto FormData (en vez de URLSearchParams) porque la solicitud puede
    // incluir un archivo binario (la imagen de prueba), algo que FormData soporta nativamente.
    const formData = new FormData();
    // Se indica al servlet, mediante el campo "accion", qué operación debe ejecutar.
    formData.append('accion', 'crearDevolucion');
    // Se agrega el id del pedido (sub-pedido) sobre el cual se solicita la devolución.
    formData.append('idPedido', idPedido);
    // Se agrega el motivo de la devolución.
    formData.append('motivo', motivo);
    // Se valida si el usuario seleccionó una imagen de prueba.
    if (inputImg.files[0]) {
        // Se agrega el archivo de imagen al FormData, si fue seleccionado.
        formData.append('imagenPrueba', inputImg.files[0]);
    }

    try {
        // Se envía la solicitud POST al DevolucionServlet con el FormData (incluye la imagen si existe).
        const res  = await fetch('/KurmiProyect/DevolucionServlet', {
            method: 'POST',
            body: formData
        });
        // Se parsea la respuesta JSON del servidor.
        const data = await res.json();

        // Se valida si la solicitud de devolución fue creada exitosamente.
        if (data.ok) {
            // Se cierra el modal del formulario de devolución.
            overlay.remove();
            // Se muestra un toast confirmando el envío exitoso.
            mostrarToast('Solicitud de devolución enviada correctamente');
            // Se cierra también el modal de detalle del pedido (si estaba abierto detrás del
            // formulario de devolución), porque sigue mostrando los productos con los datos
            // viejos (botón activo, sin tieneDevolucion). Forzar su cierre evita que el cliente
            // vea el producto todavía "disponible para devolver" justo después de solicitarla;
            // al volver a abrir el pedido, el modal se reconstruye con datos frescos del server.
            // Se busca el modal de detalle del pedido, si está presente en el DOM.
            const modalDetalle = document.getElementById('modalOverlay');
            // Se oculta el modal de detalle para forzar que se reconstruya con datos frescos
            // la próxima vez que el usuario lo abra.
            if (modalDetalle) modalDetalle.classList.add('hidden');
            // Recargar la pestaña de entregados para reflejar el cambio de estado
            // Se vuelve a cargar la pestaña "Entregado" (8) para que el pedido ya no aparezca
            // con el botón de devolución disponible.
            cargarPedidos('8');
        } else {
            // Se muestra el mensaje de error devuelto por el servidor, o uno genérico si no viene.
            errorEl.textContent = data.error || 'No se pudo enviar la solicitud.';
            errorEl.classList.remove('hidden');
            // Se reactiva el botón de enviar para permitir un nuevo intento.
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }
    } catch (e) {
        // Se captura cualquier error de red ocurrido durante el envío.
        console.error('Error al enviar devolución:', e);
        errorEl.textContent = 'Error de red. Intenta de nuevo.';
        errorEl.classList.remove('hidden');
        // Se reactiva el botón de enviar tras el error.
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar solicitud';
    }
}

// ── Toast de notificación ─────────────────────────────────────────────────────
function mostrarToast(mensaje) {
    // Se crea el elemento visual del toast de notificación.
    const toast = document.createElement('div');
    toast.className = 'dev__toast';
    // Se asigna el mensaje recibido como texto del toast.
    toast.textContent = mensaje;
    // Se agrega el toast al final del body.
    document.body.appendChild(toast);
    // Se activa la clase "visible" después de un breve retraso, para que la animación CSS de
    // entrada se ejecute correctamente.
    setTimeout(() => toast.classList.add('dev__toast--visible'), 50);
    // Se programa, tras 3.5 segundos, ocultar el toast y luego eliminarlo del DOM.
    setTimeout(() => {
        toast.classList.remove('dev__toast--visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ═════════════════════════════════════════════════════════════════════════════
// MIS DEVOLUCIONES — Apartado del cliente
// ═════════════════════════════════════════════════════════════════════════════

async function cargarMisDevoluciones() {
    // Se obtiene el contenedor donde se mostrarán las tarjetas de devoluciones.
    const grid = document.getElementById('pedidosGrid');
    // Se muestra el mensaje de carga mientras se espera la respuesta del servidor.
    mostrarMensajeEstado(grid, 'pedidos__cargando', 'Cargando solicitudes…');

    try {
        // Se solicita al DevolucionServlet, mediante GET y el parámetro accion=misDevoluciones,
        // la lista de solicitudes de devolución realizadas por el usuario actual.
        const res  = await fetch('/KurmiProyect/DevolucionServlet?accion=misDevoluciones');
        // Se valida si la sesión expiró (401 o 403); en ese caso se redirige al login.
        if (res.status === 401|| res.status === 403) { window.location.replace('/KurmiProyect/inicioSesion.html'); return; }
        // Se parsea la respuesta JSON del servidor.
        const data = await res.json();

        // Se limpia el contenedor antes de pintar las tarjetas nuevas.
        grid.innerHTML = '';

        // Se valida si la respuesta no fue exitosa o si no hay devoluciones registradas.
        if (!data.ok || !data.devoluciones || data.devoluciones.length === 0) {
            // Se muestra un mensaje indicando que el usuario aún no tiene solicitudes de devolución.
            mostrarMensajeEstado(grid, 'pedidos__vacio', ':( Aún no has enviado solicitudes de devolución.');
            return;
        }

        // Se recorre cada devolución recibida (con "for...of" porque crearTarjetaDevolucion es
        // asíncrona y se necesita esperar cada una antes de continuar con la siguiente).
        for (const dev of data.devoluciones) {
            // Se construye la tarjeta visual correspondiente a esta solicitud de devolución.
            const card = await crearTarjetaDevolucion(dev);
            // Se agrega la tarjeta al contenedor visible.
            grid.appendChild(card);
        }

    } catch (e) {
        // Se captura cualquier error de red ocurrido durante la carga de devoluciones.
        console.error('Error cargando devoluciones:', e);
        // Se muestra un mensaje de error genérico al usuario.
        mostrarMensajeEstado(grid, 'pedidos__vacio', 'Error al cargar solicitudes.');
    }
}

// Se declara una variable de caché a nivel de módulo para guardar la plantilla HTML
// de la tarjeta de devolución una sola vez y reutilizarla en cada llamada, evitando
// peticiones repetidas al servidor por cada tarjeta.
let plantillaTarjetaDevolucion = null;

async function crearTarjetaDevolucion(dev) {
    // Se define el mapa de configuración visual (color de fondo, color de texto e ícono)
    // según el texto de estado de la devolución que llega desde el servidor.
    const cfgEstado = {
        'Pendiente': { bg: '#e67e22', color: '#fff', icon: '...' },
        'Aprobada':  { bg: '#2ecc71', color: '#fff', icon: ':)' },
        'Rechazada': { bg: '#e74c3c', color: '#fff', icon: ':(' }
    };
    // Se obtiene la configuración correspondiente al estado de esta devolución, o un valor
    // por defecto neutro si el estado no coincide con ninguno de los definidos.
    const cfg = cfgEstado[dev.estado] || { bg: '#aaa', color: '#fff', icon: '?' };

    // Se define la ruta base donde se almacenan las imágenes de productos en el servidor.
    const BASE_IMG = '/KurmiProyect/RESOURCES/img/';

    // Bug fix 1: mostrar imagen del primer producto del pedido, no imagenPrueba
    // Se arma la URL de la imagen a mostrar: se usa la imagen del primer producto del pedido
    // (imagenPrimera) en vez de la imagen de prueba subida por el cliente, salvo que sea la
    // imagen genérica, en cuyo caso se usa el ícono local por defecto.
    const imgSrc = (dev.imagenPrimera && dev.imagenPrimera !== 'inicioHelado.png')
        ? BASE_IMG + dev.imagenPrimera
        : '../../RESOURCES/img/inicioHelado.png';

    // Cargar la plantilla una sola vez
    // Se valida si la plantilla de la tarjeta de devolución todavía no fue cargada en caché.
    if (!plantillaTarjetaDevolucion) {
        // Se solicita al servidor el archivo HTML de la plantilla de la tarjeta.
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaDevolucion.html');
        // Se obtiene el contenido como texto.
        const templateHTML = await responseTemplate.text();
        // Se crea un parser de DOM para convertir el texto HTML en un documento manipulable.
        const parser = new DOMParser();
        // Se parsea el HTML de la plantilla a un documento DOM independiente.
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        // Se extrae y se guarda en caché el nodo raíz de la tarjeta (con clase "pedido__card").
        plantillaTarjetaDevolucion = docTemplate.querySelector('.pedido__card');
    }

    // Se clona profundamente la plantilla en caché para crear una nueva instancia independiente
    // de tarjeta, sin necesidad de volver a pedir o parsear el HTML cada vez.
    const card = plantillaTarjetaDevolucion.cloneNode(true);
    // Se le da estilo de cursor tipo "mano" para indicar que la tarjeta es clickeable.
    card.style.cursor = 'pointer';

    // Se busca el elemento de imagen dentro de la tarjeta clonada.
    const img = card.querySelector('img.pedido__img');
    // Se asigna la URL de imagen calculada previamente.
    img.src = imgSrc;
    // Se define un manejador de error: si la imagen falla al cargar, se reemplaza por la imagen
    // genérica local, evitando mostrar un ícono de imagen rota.
    img.onerror = () => { img.src = '../../RESOURCES/img/inicioHelado.png'; };

    // Se rellena la fecha del pedido, recortando el string para mostrar solo la parte de fecha
    // (los primeros 10 caracteres, formato yyyy-MM-dd) y omitiendo la hora.
    card.querySelector('#devCardFecha').textContent =
        `Pedido del ${dev.fechaPedido ? dev.fechaPedido.substring(0, 10) : ''}`;

    // Se obtiene el elemento del badge de estado dentro de la tarjeta.
    const badge = card.querySelector('#devCardEstadoBadge');
    // Se arma el texto del badge combinando el ícono y el texto del estado.
    badge.textContent = `${cfg.icon} ${dev.estado}`;
    // Se aplican los colores correspondientes al estado de la devolución.
    badge.style.background = cfg.bg;
    badge.style.color = cfg.color;

    // Se rellena el motivo de la devolución indicado por el cliente.
    card.querySelector('#devCardMotivo').textContent = dev.motivo;
    // Se rellena el total pagado del pedido asociado, con formato de moneda colombiana.
    card.querySelector('#devCardTotal').textContent =
        `Total pedido: $${Number(dev.totalPago).toLocaleString('es-CO')}`;

    // Se valida si el administrador ya respondió la solicitud con un motivo de respuesta.
    if (dev.motivoRespuesta) {
        // Se obtiene el bloque que contiene la respuesta del administrador.
        const bloqueResp = card.querySelector('#devCardMotivoResp');
        // Se hace visible ese bloque, que normalmente está oculto.
        bloqueResp.classList.remove('hidden');
        // Se rellena el texto con el motivo de la respuesta del administrador.
        card.querySelector('#devCardMotivoRespTexto').textContent = dev.motivoRespuesta;
    }

    // Se arma el texto base con la fecha en que se envió la solicitud de devolución.
    let textoSolicitud = `Solicitud enviada: ${dev.fechaSolicitud ? dev.fechaSolicitud.substring(0, 10) : ''}`;
    // Se valida si ya existe una fecha de respuesta del administrador.
    if (dev.fechaRespuesta) {
        // Se concatena la fecha de respuesta al texto, si está disponible.
        textoSolicitud += ` · Respondida: ${dev.fechaRespuesta.substring(0, 10)}`;
    }
    // Se asigna el texto final con las fechas de solicitud (y respuesta, si aplica).
    card.querySelector('#devCardFechaSolicitud').textContent = textoSolicitud;

    // Bug fix 2: click abre el modal con los productos del pedido original
    // Se registra el evento click sobre la tarjeta de devolución, para abrir el modal de
    // detalle del pedido original asociado a esta solicitud.
    card.addEventListener('click', async () => {
        try {
            // Mapeamos el nombre del estado al ID en la base de datos
            // Se define por defecto el id numérico de estado "9" (Devolución, ya gestionada).
            let idEstadoNum = '9'; // Por defecto estado Devolucion
            // Se valida si el estado de esta solicitud es "Devolucion Solicitada" (aún pendiente),
            // en cuyo caso corresponde al id "10" según el script SQL de EstadoPedido.
            if (dev.estado === 'Devolucion Solicitada') {
                idEstadoNum = '10'; // ID del script SQL para solicitada
            }

            // Enviamos el ID dinámico al Servlet
            // Se solicita al PedidosServlet la lista de pedidos del usuario filtrados por
            // el estado correspondiente (9 o 10), para poder localizar el pedido completo.
            const res = await fetch(`/KurmiProyect/PedidosServlet?estado=${idEstadoNum}`);
            // Se corta la ejecución si la respuesta no fue exitosa (status fuera del rango 200-299).
            if (!res.ok) return;

            // Se parsea la lista de pedidos devuelta por el servidor.
            const pedidos = await res.json();
            // Se busca, dentro de esa lista, el pedido cuyo idPedido coincide con el de esta devolución.
            const pedido  = pedidos.find(p => p.idPedido === dev.idPedido);

            // Abrimos el modal pasándole el estado correcto
            // Se abre el modal de detalle solo si el pedido fue encontrado, pasando el id de
            // estado numérico para que el modal muestre el título y comportamiento adecuados.
            if (pedido) abrirModal(pedido, idEstadoNum);
        } catch (e) {
            // Se captura cualquier error de red al intentar abrir el detalle de la devolución.
            console.error('Error al abrir detalle de devolución:', e);
        }
    });
    

    // Se devuelve la tarjeta de devolución ya completamente construida.
    return card;
}

// ── Modal (detalle de pedido — sin cambios) ───────────────────────────────────
function abrirModal(pedido, filtroActivo) {
    // Se obtienen las referencias a todos los elementos clave del modal de detalle:
    // el overlay (fondo), el título, la fecha, el badge de estado, el contenedor de
    // productos y el pie de página (footer) donde van los botones de acción.
    const overlay    = document.getElementById('modalOverlay');
    const titulo     = document.getElementById('modalTitulo');
    const fecha      = document.getElementById('modalFecha');
    const badgeEl    = document.getElementById('modalEstadoBadge');
    const productos  = document.getElementById('modalProductos');
    const footer     = document.getElementById('modalFooter');

    // Se define el diccionario de títulos legibles según la pestaña/filtro activo
    // desde el cual se abrió el modal.
    const etiquetasTitulo = {
        '1':          'Pedido Pendiente',
        'en_proceso': 'Pedido En Proceso',
        '8':          'Pedido Entregado',
        '9':          'Devolución',
        '3':          'Pedido Cancelado'
    };
    // Se asigna el título del modal según el filtro activo, o un título genérico si no coincide.
    titulo.textContent = etiquetasTitulo[filtroActivo] || 'Detalle del pedido';
    // Se arma el texto de fecha y método de pago que se muestra debajo del título.
    fecha.textContent  = 'Fecha: ' + (pedido.fechaPedido || '') +
                         '  ·  Pago: ' + (pedido.metodoPago || 'No registrado');

    // Se limpia el contenedor del badge de estado antes de reconstruirlo.
    badgeEl.innerHTML = '';
    // Se valida que el pedido traiga un nombre de estado antes de pintar el badge.
    if (pedido.nombreEstado) {
        // Se obtiene la configuración de color correspondiente al estado del pedido.
        const cfg = estadoBadgeConfig(pedido.estadoPedido);
        // Se crea el elemento span del badge.
        const span = document.createElement('span');
        span.className = 'modal__estado-badge';
        // Se asigna el texto del estado.
        span.textContent = pedido.nombreEstado;
        // Se aplican los colores de fondo y texto correspondientes al estado.
        span.style.background = cfg.bg;
        span.style.color = cfg.color;
        // Se agrega el badge al contenedor.
        badgeEl.appendChild(span);
    }

    // Se limpian el contenedor de productos y el footer, para reconstruirlos desde cero
    // cada vez que se abre el modal (evita arrastrar contenido de una apertura anterior).
    productos.innerHTML = '';
    footer.innerHTML    = '';

    // Lista de productos del pedido (plana, sin separación por proveedor)
    // Se construye la lista completa de productos a mostrar: si el pedido viene agrupado
    // por proveedores (subpedidos), se aplanan todos sus productos en una sola lista;
    // si no, se usa directamente la lista plana de productos del pedido.
    const todosLosProductos = (pedido.subpedidos && pedido.subpedidos.length > 0)
        ? pedido.subpedidos.flatMap(sub => sub.productos || [])
        : (pedido.productos || []);

    // Se recorre cada producto del pedido para construir su tarjeta dentro del modal.
    todosLosProductos.forEach(prod => {
        // Se crea el contenedor de la tarjeta de producto.
        const card = document.createElement('div');
        card.className = 'modal__prod-card';

        // Se crea la imagen del producto.
        const img = document.createElement('img');
        img.className = 'modal__prod-img';
        // Se define la ruta base de imágenes del servidor (variable local, distinta a la usada
        // en otras funciones, pero con el mismo propósito).
        const BASE_IMG_MOD = '/KurmiProyect/RESOURCES/img/';
        // Se calcula la URL de la imagen del producto, usando la imagen por defecto si no
        // viene una válida desde el servidor.
        img.src = (prod.imagen && prod.imagen !== 'inicioHelado.png')
            ? BASE_IMG_MOD + prod.imagen
            : '../../RESOURCES/img/inicioHelado.png';
        // Se asigna el texto alternativo de la imagen usando el nombre del producto.
        img.alt = prod.nombre;

        // Se crea el contenedor de información textual del producto (nombre y detalle).
        const info = document.createElement('div');
        info.className = 'modal__prod-info';

        // Se crea el párrafo con el nombre del producto.
        const nombre = document.createElement('p');
        nombre.className = 'modal__prod-nombre';
        nombre.textContent = prod.nombre;

        // Se crea el párrafo con la cantidad y el precio total de la línea de este producto.
        const det = document.createElement('p');
        det.className = 'modal__prod-detalle';
        det.textContent = 'Cantidad: ' + prod.cantidad + '  ·  $' + Number(prod.precioTotal).toLocaleString('es-CO');

        // Se ensambla la información (nombre y detalle) dentro de su contenedor.
        info.appendChild(nombre);
        info.appendChild(det);
        // Se ensambla la imagen y la información dentro de la tarjeta del producto.
        card.appendChild(img);
        card.appendChild(info);

        // Botón de devolución por producto — solo en pedidos Entregados (8), dentro de las
        // primeras 24 horas desde la compra, sobre el sub-pedido (proveedor) específico de
        // ESTE producto, y solo si ese sub-pedido todavía no tiene una devolución en curso.
        // Se valida que el filtro activo sea "Entregado" (8) y que el producto traiga un
        // idPedido propio (es decir, pertenece a un sub-pedido identificable de un proveedor).
        if (filtroActivo === '8' && prod.idPedido) {
            // Se obtiene la fecha completa del pedido (con hora), usando la fecha simple como respaldo.
            const fechaRaw     = pedido.fechaPedidoCompleta || pedido.fechaPedido;
            // Se convierte el string de fecha a un objeto Date válido.
            const fechaEntrega = new Date(fechaRaw.replace(' ', 'T'));
            // Se obtiene la fecha y hora actuales.
            const ahora        = new Date();
            // Se calcula la diferencia en horas entre el momento actual y la fecha de entrega.
            const diffHoras    = (ahora - fechaEntrega) / (1000 * 60 * 60);

            // Se valida que no hayan pasado más de 24 horas y que este producto en particular
            // todavía no tenga una devolución registrada (prod.tieneDevolucion), antes de
            // ofrecer el botón de devolución específico de este producto.
            if (diffHoras <= 24 && !prod.tieneDevolucion) {
                // Se crea el botón de "Solicitar devolución" para este producto puntual.
                const btnDevolverProd = document.createElement('button');
                btnDevolverProd.className = 'btn__pedido-devolver btn__modal-prod-devolver';
                btnDevolverProd.textContent = 'Solicitar devolución';
                // Se registra el evento click del botón.
                btnDevolverProd.addEventListener('click', e => {
                    // Se evita que el click se propague hacia otros elementos contenedores.
                    e.stopPropagation();
                    // Se abre el formulario de devolución usando el idPedido propio de ESTE
                    // producto (su sub-pedido de proveedor), no el idPedido general del grupo.
                    abrirFormDevolucion(prod.idPedido, pedido.fechaPedido);
                });
                // Se agrega el botón a la información del producto.
                info.appendChild(btnDevolverProd);
            }
        }

        // Se agrega la tarjeta del producto ya completa al contenedor de productos del modal.
        productos.appendChild(card);
    });

    // Se calcula sumando los precioTotal de los productos reales mostrados en el modal.
    // Usar pedido.totalPago puede ser solo el subtotal de un proveedor cuando la compra
    // tiene varios proveedores pero la BD guarda un pedido por proveedor.
    // Se calcula el total real sumando el precioTotal de cada producto efectivamente mostrado,
    // en lugar de confiar en pedido.totalPago (que puede representar solo un sub-pedido).
    const totalCalculado = todosLosProductos.reduce((acc, p) => acc + Number(p.precioTotal || 0), 0);
    // Se crea el párrafo que muestra el total calculado en el footer del modal.
    const spanTotal = document.createElement('p');
    spanTotal.className = 'modal__total-texto';
    spanTotal.textContent = 'Total: $' + totalCalculado.toLocaleString('es-CO');
    // Se agrega el total al footer del modal.
    footer.appendChild(spanTotal);

    // Botón recomprar — solo en Cancelado (3)
    // Se valida si el filtro activo corresponde a la pestaña "Cancelado" (3), único caso
    // donde se ofrece la opción de volver a comprar el pedido.
    if (filtroActivo === '3') {
        // Se crea el elemento <select> para elegir el método de pago de la recompra.
        const selectMetodo = document.createElement('select');
        selectMetodo.id = 'selectMetodoRecompra';

        // Se crea la opción por defecto (placeholder), deshabilitada y preseleccionada,
        // que obliga al usuario a elegir explícitamente un método de pago.
        const opcionDefault = document.createElement('option');
        opcionDefault.value = '';
        opcionDefault.disabled = true;
        opcionDefault.selected = true;
        opcionDefault.textContent = 'Método de pago';

        // Se crea la opción de pago en efectivo (id de método 1).
        const opcionEfectivo = document.createElement('option');
        opcionEfectivo.value = '1';
        opcionEfectivo.textContent = 'Efectivo';

        // Se crea la opción de pago por Nequi (id de método 2).
        const opcionNequi = document.createElement('option');
        opcionNequi.value = '2';
        opcionNequi.textContent = 'Nequi';

        // Se agregan las tres opciones (placeholder, efectivo y Nequi) al select.
        selectMetodo.appendChild(opcionDefault);
        selectMetodo.appendChild(opcionEfectivo);
        selectMetodo.appendChild(opcionNequi);

        // Se crea el botón de "Comprar nuevamente".
        const btnRecomprar = document.createElement('button');
        btnRecomprar.className = 'btn__modal-comprar';
        btnRecomprar.textContent = 'Comprar nuevamente';
        // Se define el comportamiento al hacer click sobre el botón de recompra.
        btnRecomprar.onclick = () => {
            // Se obtiene el id del método de pago seleccionado en el select.
            const idMetodo = selectMetodo.value;
            // Se valida que el usuario haya elegido un método de pago antes de continuar.
            if (!idMetodo) { alert('Selecciona un método de pago.'); return; }
            // Se invoca la función que reactiva el pedido cancelado con el método de pago elegido.
            recomprarPedido(pedido.idPedido, parseInt(idMetodo));
        };

        // Se agregan el select de método de pago y el botón de recompra al footer del modal.
        footer.appendChild(selectMetodo);
        footer.appendChild(btnRecomprar);
    }

    // Se quita la clase "hidden" del overlay, haciendo visible el modal en pantalla.
    overlay.classList.remove('hidden');
}

// ── Recomprar ─────────────────────────────────────────────────────────────────
async function recomprarPedido(idPedido, idMetodo) {
    try {
        // Se envía una solicitud POST al CambiarEstadoPedidoServlet para reactivar el pedido
        // cancelado, cambiando su estado de vuelta a "1" (Pendiente) y asignando el nuevo
        // método de pago elegido por el usuario.
        const res = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'idPedido=' + encodeURIComponent(idPedido) +
                  '&nuevoEstado=1' +
                  '&idMetodo=' + encodeURIComponent(idMetodo)
        });
        // Se parsea la respuesta JSON del servidor.
        const data = await res.json();
        // Se valida si la reactivación fue exitosa.
        if (data.ok) {
            // Se notifica al usuario que el pedido fue reactivado correctamente.
            alert('¡Pedido reactivado! Ya aparece en Pendientes.');
            // Se oculta el modal de detalle del pedido.
            document.getElementById('modalOverlay').classList.add('hidden');
            // Se recarga la pestaña de Pendientes para mostrar el pedido recién reactivado.
            cargarPedidos('3');
        } else {
            // Se notifica al usuario que la reactivación falló, mostrando el motivo si viene del servidor.
            alert('No se pudo reactivar: ' + (data.msg || 'error desconocido'));
        }
    } catch (e) {
        // Se captura cualquier error de red durante el proceso de recompra.
        console.error('Error al reactivar pedido:', e);
        alert('Error de red al reactivar el pedido.');
    }
}

// ── Cerrar modal ──────────────────────────────────────────────────────────────
// Se registra el evento click del botón "X" del modal de detalle, para cerrarlo
// agregándole la clase "hidden".
document.getElementById('modalCerrar').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.add('hidden');
});
// Se registra el evento click sobre el overlay del modal de detalle: si el click ocurrió
// directamente sobre el fondo (no sobre el contenido interno), se cierra el modal.
document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});