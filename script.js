const campaigns = {
  "Engenharia Civil": {
    title: "Engenharia Civil — Turma 2026",
    label: "Engenharia Civil",
    image: "assets/campaign-engineering.png",
    deadline: "Pedidos até 31 de agosto",
    pickup: "Retirada em 30/09, na Faculdade Mendes"
  },
  "Enfermagem": {
    title: "Enfermagem — Turma 2026",
    label: "Enfermagem",
    image: "assets/campaign-nursing.png",
    deadline: "Pedidos até 15 de setembro",
    pickup: "Retirada em 15/10, na Faculdade Mendes"
  },
  "Administração": {
    title: "Administração — Turma 2026",
    label: "Administração",
    image: "assets/campaign-admin.png",
    deadline: "Pedidos até 20 de setembro",
    pickup: "Retirada em 20/10, na Faculdade Mendes"
  }
};

const unitPrice = 59.9;
const state = {
  campaign: campaigns["Engenharia Civil"],
  type: "Comum",
  size: "M",
  quantity: 1,
  personalization: ""
};

const views = [...document.querySelectorAll("[data-view]")];
const header = document.getElementById("site-header");
const footer = document.getElementById("site-footer");
const mobileNav = document.getElementById("mobile-nav");
const menuToggle = document.getElementById("menu-toggle");
const adminSidebar = document.getElementById("admin-sidebar");
const overlay = document.getElementById("overlay");
const cartDrawer = document.getElementById("cart-drawer");
const toast = document.getElementById("toast");
let toastTimer;

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function showToast(message) {
  clearTimeout(toastTimer);
  document.getElementById("toast-message").textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function closeMobileMenu() {
  mobileNav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.querySelector(".material-symbols-rounded").textContent = "menu";
}

function showView(name, options = {}) {
  views.forEach((view) => view.classList.toggle("active", view.dataset.view === name));
  document.body.dataset.currentView = name;
  const adminMode = name === "admin";
  header.hidden = adminMode;
  footer.hidden = adminMode || name === "admin-login";
  closeMobileMenu();
  closeCart();
  adminSidebar?.classList.remove("open");
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
}

function scrollHomeSection(id) {
  showView("home");
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

document.addEventListener("click", (event) => {
  const goButton = event.target.closest("[data-go]");
  if (goButton) {
    showView(goButton.dataset.go);
    return;
  }

  const scrollButton = event.target.closest("[data-scroll]");
  if (scrollButton) {
    scrollHomeSection(scrollButton.dataset.scroll);
    return;
  }

  const campaignButton = event.target.closest("[data-campaign]");
  if (campaignButton) {
    selectCampaign(campaignButton.dataset.campaign);
    showView("campaign");
    return;
  }

  const adminPageButton = event.target.closest("[data-admin-page]");
  if (adminPageButton) {
    setAdminPage(adminPageButton.dataset.adminPage);
  }
});

menuToggle.addEventListener("click", () => {
  const open = mobileNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.querySelector(".material-symbols-rounded").textContent = open ? "close" : "menu";
});

const campaignFilter = document.getElementById("campaign-filter");
campaignFilter.addEventListener("input", () => {
  const query = campaignFilter.value.trim().toLocaleLowerCase("pt-BR");
  const cards = [...document.querySelectorAll(".campaign-card")];
  let visible = 0;
  cards.forEach((card) => {
    const show = card.dataset.search.includes(query);
    card.hidden = !show;
    if (show) visible += 1;
  });
  document.getElementById("campaign-empty").hidden = visible !== 0;
});

function selectCampaign(name) {
  state.campaign = campaigns[name] || campaigns["Engenharia Civil"];
  document.getElementById("product-course-label").textContent = state.campaign.label;
  document.getElementById("product-title").textContent = state.campaign.title;
  document.getElementById("product-image").src = state.campaign.image;
  document.querySelector(".deadline-box strong").textContent = state.campaign.deadline;
  document.querySelector(".deadline-box small").textContent = state.campaign.pickup;
  updateOrder();
}

document.getElementById("type-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-type]");
  if (!button) return;
  state.type = button.dataset.type;
  document.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("active", item === button));
  updateOrder();
});

document.getElementById("size-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-size]");
  if (!button) return;
  state.size = button.dataset.size;
  document.querySelectorAll("[data-size]").forEach((item) => item.classList.toggle("active", item === button));
  updateOrder();
});

const quantityInput = document.getElementById("quantity");
function setQuantity(value) {
  state.quantity = Math.max(1, Math.min(20, Number(value) || 1));
  quantityInput.value = state.quantity;
  updateOrder();
}
document.getElementById("qty-minus").addEventListener("click", () => setQuantity(state.quantity - 1));
document.getElementById("qty-plus").addEventListener("click", () => setQuantity(state.quantity + 1));
quantityInput.addEventListener("input", () => setQuantity(quantityInput.value));
document.getElementById("personalization").addEventListener("input", (event) => {
  state.personalization = event.target.value.trim();
  updateOrder();
});

function updateOrder() {
  const total = unitPrice * state.quantity;
  const quantityText = `${state.quantity} ${state.quantity === 1 ? "unidade" : "unidades"}`;
  document.getElementById("product-total").textContent = formatCurrency(total);
  document.getElementById("cart-image").src = state.campaign.image;
  document.getElementById("cart-product-name").textContent = state.campaign.title;
  document.getElementById("cart-variant").textContent = `${state.type} • ${state.size} • ${quantityText}`;
  document.getElementById("cart-personalization").textContent = state.personalization ? `Personalização: ${state.personalization}` : "";
  document.getElementById("cart-total").textContent = formatCurrency(total);
  document.getElementById("summary-image").src = state.campaign.image;
  document.getElementById("summary-product-name").textContent = state.campaign.title;
  document.getElementById("summary-variant").textContent = `${state.type} • ${state.size} • ${quantityText}`;
  document.getElementById("summary-subtotal").textContent = formatCurrency(total);
  document.getElementById("summary-total").textContent = formatCurrency(total);
}

function openCart() {
  updateOrder();
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  document.body.classList.add("drawer-open");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.body.classList.remove("drawer-open");
}

document.getElementById("add-to-cart").addEventListener("click", openCart);
document.getElementById("close-cart").addEventListener("click", closeCart);
document.getElementById("continue-shopping").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
document.getElementById("continue-checkout").addEventListener("click", () => {
  closeCart();
  showView("checkout");
});

const sizeDialog = document.getElementById("size-dialog");
document.getElementById("size-guide-button").addEventListener("click", () => sizeDialog.showModal());
document.getElementById("close-size-dialog").addEventListener("click", () => sizeDialog.close());

document.querySelectorAll(".payment-card input").forEach((radio) => {
  radio.addEventListener("change", () => {
    document.querySelectorAll(".payment-card").forEach((card) => {
      card.classList.toggle("active", card.querySelector("input").checked);
    });
  });
});

document.getElementById("checkout-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Processando...";
  setTimeout(() => {
    button.disabled = false;
    button.textContent = "Pagar pedido";
    showToast("Pagamento simulado aprovado. Pedido #CM-2049 criado!");
    form.reset();
    document.querySelectorAll(".payment-card").forEach((card, index) => card.classList.toggle("active", index === 0));
    setTimeout(() => showView("home"), 900);
  }, 850);
});

document.getElementById("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showView("admin");
  setAdminPage("overview");
  showToast("Bem-vindo ao painel da Camisaria Mendes.");
});

const adminTitles = {
  overview: "Visão geral",
  campaigns: "Campanhas",
  products: "Produtos",
  orders: "Pedidos",
  reports: "Relatórios",
  settings: "Configurações"
};

function setAdminPage(page) {
  document.querySelectorAll(".admin-page").forEach((section) => section.classList.toggle("active", section.dataset.adminContent === page));
  document.querySelectorAll(".admin-nav").forEach((button) => button.classList.toggle("active", button.dataset.adminPage === page));
  document.getElementById("admin-page-title").textContent = adminTitles[page] || "Visão geral";
  adminSidebar.classList.remove("open");
}

document.getElementById("admin-menu-button").addEventListener("click", () => adminSidebar.classList.toggle("open"));

document.getElementById("product-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get("campaignName");
  showToast(`Produto “${name}” cadastrado com sucesso.`);
  event.currentTarget.reset();
});

document.getElementById("settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("Configurações salvas com sucesso.");
});

function filterOrders() {
  const search = document.getElementById("order-search").value.toLocaleLowerCase("pt-BR");
  const payment = document.getElementById("payment-filter").value;
  document.querySelectorAll("#orders-body tr").forEach((row) => {
    const matchesText = row.textContent.toLocaleLowerCase("pt-BR").includes(search);
    const matchesPayment = !payment || row.dataset.payment === payment;
    row.hidden = !(matchesText && matchesPayment);
  });
}
document.getElementById("order-search").addEventListener("input", filterOrders);
document.getElementById("payment-filter").addEventListener("change", filterOrders);

const reportRows = [
  ["Tipo", "Tamanho", "Quantidade paga"],
  ["Comum", "M", 28],
  ["Comum", "G", 17],
  ["Oversized", "M", 12],
  ["Oversized", "G", 19],
  ["Baby Look", "P", 14],
  ["Baby Look", "M", 21]
];

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

document.querySelectorAll("[data-export]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.export === "csv") {
      const csv = reportRows.map((row) => row.map((value) => `"${value}"`).join(";")).join("\n");
      downloadBlob(`\uFEFF${csv}`, "relatorio-camisaria-mendes.csv", "text/csv;charset=utf-8");
      showToast("Relatório CSV exportado.");
      return;
    }
    const rows = reportRows.map((row) => `<tr>${row.map((value) => `<td>${value}</td>`).join("")}</tr>`).join("");
    const html = `<html><meta charset="utf-8"><table>${rows}</table></html>`;
    downloadBlob(html, "relatorio-camisaria-mendes.xls", "application/vnd.ms-excel");
    showToast("Relatório Excel exportado.");
  });
});

document.getElementById("print-report").addEventListener("click", () => window.print());

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeMobileMenu();
    adminSidebar?.classList.remove("open");
  }
});

updateOrder();
showView("home", { keepScroll: true });
