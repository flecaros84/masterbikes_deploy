// catalogo.js

// --- Selectores ---
const productContainer = document.getElementById('productContainer');
const resultsCount     = document.getElementById('resultsCount');
const totalCount       = document.getElementById('totalCount');

const priceRange       = document.getElementById('priceRange');
const minPriceInput    = document.getElementById('minPrice');
const maxPriceInput    = document.getElementById('maxPrice');

const brandFilter      = document.getElementById('brandFilter');
const sizeFilter       = document.getElementById('sizeFilter');
const sortOptions      = document.getElementById('sortOptions');

const gridView         = document.getElementById('gridView');
const listView         = document.getElementById('listView');

const clearFiltersBtn = document.getElementById('clearFilters');

// --- Constantes y estado ---
const GATEWAY_URL = 'https://api-gateway-5ww5.onrender.com';
let branchMap = {};

let filters = {
    minPrice: 0,
    maxPrice: 3000000,
    brand:    'Todas',
    size:     'Todas'
};
let currentSort = 'relevance';
let viewMode    = 'grid';

window.bikeData = [];

// --- API auxiliares ---
const API = {
    getSucursales: () =>
        fetch(`${GATEWAY_URL}/api/sucursal/api/v1/sucursales`)
            .then(res => res.ok ? res.json() : Promise.reject(res.status)),
    getStockBicicleta: (productId, tipo) =>
        fetch(`${GATEWAY_URL}/api/inventario/api/v1/inventarios/cantidad?productoId=${productId}&tipoProducto=${tipo}`)
            .then(res => res.ok ? res.json() : Promise.reject(res.status))
};

// --- Inicio ---
document.addEventListener('DOMContentLoaded', () => {
    // 1) Cargar nombres de sucursales
    API.getSucursales()
        .then(arr => arr.forEach(s => branchMap[s.id] = s.nombre))
        .catch(err => console.error('Error cargando sucursales', err));

    // 2) Ahora con async/await para cargar catálogo y stock en orden
    (async () => {
        try {
            const res = await fetch(`${GATEWAY_URL}/api/catalogo/api/v1/catalogo/bicicletas`);
            if (!res.ok) throw new Error(res.status);
            const data = await res.json();

            const predef = data.filter(i => i.esPredefinida);
            window.bikeData = predef.map(item => ({
                id:         item.id,
                name:       item.modelo,
                brand:      item.marca,
                type:       item.marco.tipoUso,
                size:       item.tallaUsuario,
                price:      item.precioUnitario,
                rating:     item.valoracion || 0,
                description:item.descripcion,
                image:      item.marco.imagenUrl || `../images/bicicletas/${item.id}.jpg`,
                detailPage: `detalle.html?id=${item.id}`,
                sucursales: [],
                stock:      0
            }));

            totalCount.textContent = window.bikeData.length;

            // 3) ESPERAR a que cargue el stock antes de seguir
            await initializeStockInfo();

            // 4) Ahora sí: filtros, UI y render inicial
            populateFilters();
            setupFilters();
            initCatalog();
            if (typeof updateCartUI === 'function') updateCartUI();

        } catch (err) {
            console.error('Error al cargar catálogo:', err);
            productContainer.innerHTML = '<p class="text-danger">No se pudo cargar el catálogo.</p>';
        }
    })();
});

// --- Poblado dinámico de filtros ---
function populateFilters() {
    // Marca
    const marcas = [...new Set(window.bikeData.map(b => b.brand))].sort();
    marcas.forEach(m => {
        const op = new Option(m, m);
        brandFilter.append(op);
    });
    // Talla
    const tallas = [...new Set(window.bikeData.map(b => b.size))].sort((a,b)=>a-b);
    tallas.forEach(t => {
        const op = new Option(t, t);
        sizeFilter.append(op);
    });
}

// --- Listeners de filtros y orden ---
function setupFilters() {
    priceRange.addEventListener('input', () => {
        filters.maxPrice = +priceRange.value;
        maxPriceInput.value = filters.maxPrice;
        applyFilters();
    });
    minPriceInput.addEventListener('change', () => {
        filters.minPrice = +minPriceInput.value;
        applyFilters();
    });
    maxPriceInput.addEventListener('change', () => {
        filters.maxPrice = +maxPriceInput.value;
        applyFilters();
    });
    brandFilter.addEventListener('change', () => {
        filters.brand = brandFilter.value;
        applyFilters();
    });
    sizeFilter.addEventListener('change', () => {
        filters.size = sizeFilter.value;
        applyFilters();
    });
    sortOptions.addEventListener('change', () => {
        currentSort = sortOptions.value;
        applyFilters();
    });
    // Limpiar filtros
    clearFiltersBtn.addEventListener('click', resetFilters);

}

// --- Aplica filtros, orden y muestra producto ---
function applyFilters() {
    let arr = window.bikeData.filter(p => {
        if (filters.brand !== 'Todas' && p.brand !== filters.brand) return false;
        if (filters.size  !== 'Todas' && p.size  !== filters.size)  return false;
        if (p.price < filters.minPrice || p.price > filters.maxPrice) return false;
        return true;
    });

    // Orden
    switch (currentSort) {
        case 'price_asc':  arr.sort((a,b)=>a.price - b.price); break;
        case 'price_desc': arr.sort((a,b)=>b.price - a.price); break;
        case 'rating':     arr.sort((a,b)=>b.rating - a.rating); break;
        // relevance: orden original
    }

    resultsCount.textContent = arr.length;
    renderProducts(arr);
}

function resetFilters() {
    // 1) Restaurar estado de filtros
    filters.minPrice = 0;
    filters.maxPrice = +priceRange.max;
    filters.brand    = 'Todas';
    filters.size     = 'Todas';
    currentSort      = 'relevance';

    // 2) Resetear controles de UI
    minPriceInput.value   = '';
    priceRange.value      = filters.maxPrice;
    maxPriceInput.value   = filters.maxPrice;
    brandFilter.value     = 'Todas';
    sizeFilter.value      = 'Todas';
    sortOptions.value     = 'relevance';

    // 3) Volver a aplicar filtros
    applyFilters();
}

// --- Inicializa navegación, carrito, vistas ---
function initCatalog() {
    // 1) Si tienes toggle, lo inicializas, si no, lo ignoras
    if (gridView && listView) {
        setupViewButtons();
    }
    // 2) Siempre montar el carrito y pintar el catálogo
    setupAddToCartButtons();
    applyFilters();
}

// --- Botones Grid/List ---
function setupViewButtons() {
    gridView.addEventListener('click', () => setViewMode('grid'));
    listView.addEventListener('click', () => setViewMode('list'));
    const pref = localStorage.getItem('preferredView') || 'grid';
    setViewMode(pref);
}
function setViewMode(mode) {
    viewMode = mode;
    productContainer.classList.toggle('list-view', mode==='list');
    productContainer.classList.toggle('grid-view', mode==='grid');
    gridView.classList.toggle('active', mode==='grid');
    listView.classList.toggle('active', mode==='list');
    localStorage.setItem('preferredView', mode);
    applyFilters();
}

// --- Agregar al carrito con stock check ---
function setupAddToCartButtons() {
    document.addEventListener('click', ev => {
        const btn = ev.target.closest('.add-to-cart-btn');
        if (!btn) return;
        ev.preventDefault();
        const id   = btn.dataset.productId;
        const tipo = btn.dataset.productType;
        const name = btn.closest('.card').querySelector('.card-title').textContent;
        const price= parseFloat(btn.closest('.card').querySelector('[data-price]').dataset.price);
        const img  = btn.closest('.card').querySelector('img').src;
        checkStockAndAddToCart(id, name, price, img);
    });
}
async function checkStockAndAddToCart(id,name,price,img) {
    showLoadingIndicator(id);
    try {
        const suc = await API.getStockBicicleta(id, 'bicicleta');
        const qty = suc.reduce((sum,s)=>sum+s.cantidad, 0);
        hideLoadingIndicator(id);
        if (qty>0) {
            const prod = { id, name, price, image: img, quantity:1, maxStock:qty };
            if (addToCart(id,1,{},prod)) {
                updateProductStock(id);
                showSuccessNotification(name);
            }
        } else showErrorNotification('Sin stock disponible.');
    } catch {
        hideLoadingIndicator(id);
        showErrorNotification('Error validando stock.');
    }
}
function showLoadingIndicator(id) {
    const b = document.querySelector(`.add-to-cart-btn[data-product-id="${id}"]`);
    if (b) { b.disabled=true; b.innerHTML=`<span class="spinner-border spinner-border-sm"></span> Agregando...`; }
}
function hideLoadingIndicator(id) {
    const b = document.querySelector(`.add-to-cart-btn[data-product-id="${id}"]`);
    if (b) { b.disabled=false; b.innerHTML=`<i class="bi bi-cart-plus"></i> Agregar al carrito`; }
}
function showSuccessNotification(name) {
    const toastEl = document.getElementById('notificationToast');
    const toast = new bootstrap.Toast(toastEl);
    toastEl.querySelector('.toast-body').textContent = `${name} agregado al carrito.`;
    toast.show();
}
function showErrorNotification(msg) {
    const toastEl = document.getElementById('notificationToast');
    const icon    = toastEl.querySelector('.toast-header i');
    icon.className = 'bi bi-exclamation-circle-fill text-danger me-2';
    toastEl.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(toastEl).show();
    setTimeout(()=> icon.className='bi bi-check-circle-fill text-success me-2', 4000);
}

// --- Rende­rizado de tarjetas ---
function renderProducts(arr) {
    productContainer.innerHTML = '';
    if (!arr.length) {
        productContainer.innerHTML = `<p class="text-center">No hay productos que mostrar.</p>`;
        return;
    }
    arr.forEach(p => {
        const col = document.createElement('div');
        col.className = viewMode==='grid' ? 'col mb-4' : 'col-12 mb-4';
        col.innerHTML = `
      <div class="card bike-card h-100">
        <img src="${p.image}" class="card-img-top" alt="${p.name}">
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${p.name}</h5>
          <p class="card-text">${p.description}</p>
          <p class="card-text"><strong>Precio:</strong>
            <span data-price="${p.price}">${formatPrice(p.price)}</span>
          </p>
          <p class="card-text"><strong>Marca:</strong> ${p.brand}</p>
          <p class="card-text"><strong>Talla:</strong> ${p.size}</p>
          <p class="card-text"><strong>Valoración:</strong> ${p.rating}
            <i class="bi bi-star-fill text-warning"></i>
          </p>
          <p class="card-text"><strong>Stock total:</strong> ${p.stock}</p>
          <ul class="list-unstyled mb-2">
            ${Object.entries(branchMap).map(([id,n])=>{
            const fila = p.sucursales.find(s=>s.sucursalId==id);
            return `<li><strong>${n}:</strong> ${fila?fila.cantidad:0}</li>`;
        }).join('')}
          </ul>
            <div class="mt-auto">
              <button
                class="btn btn-primary add-to-cart-btn locked"
                disabled
                aria-disabled="true"
                data-product-id="${p.id}"
                data-product-type="${p.type}"
              >
                Agregar al carrito
              </button>
              <a
                href="#"
                class="btn btn-secondary mt-2 btn-details locked"
                tabindex="-1"
                aria-disabled="true"
              >
                Ver detalles
              </a>
            </div>
        </div>
      </div>`;
        productContainer.append(col);
    });
}

// --- Utilitarios ---
function formatPrice(v) {
    return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP'}).format(v);
}

// --- Inicializar stock por sucursal ---
async function initializeStockInfo() {
    await Promise.all(window.bikeData.map(async p => {
        try {
            const suc = await API.getStockBicicleta(p.id, 'bicicleta');
            p.sucursales = suc;
            p.stock = suc.reduce((sum,s)=>sum+s.cantidad,0);
        } catch {
            p.sucursales = []; p.stock = 0;
        }
    }));
}
