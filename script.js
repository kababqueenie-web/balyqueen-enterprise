let products = [];
let cart = [];


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {

    try {

        const response =
            await fetch("/api/products");

        products =
            await response.json();

        displayProducts(products);

    } catch (error) {

        console.error(error);
document.getElementById("products").innerHTML =
    "<p>Unable to load products.</p>";
}

/* ========================
   DISPLAY PRODUCTS
========================= */
function displayProducts(items) {

    const container =
        document.getElementById("products");

    container.innerHTML = "";

    if (items.length === 0) {

        container.innerHTML =
            "<p>No products available.</p>";

        return;
    }


    items.forEach(product => {

        const card =
            document.createElement("div");

        card.className =
            "product-card";

      card.style.cursor = "pointer";

card.addEventListener("click", function(event) {

    if (
        event.target.closest("button") ||
        event.target.closest(".image-thumbnail")
    ) {
        return;
    }

    window.location.href =
        "product.html?id=" + product.id;
});

        let images = [];

        try {

            images =
                JSON.parse(product.image);

            if (!Array.isArray(images)) {
                images = [product.image];
            }

        } catch (error) {

            images =
                product.image
                ? [product.image]
                : [];

        }


        if (images.length === 0) {

            images = [
                "https://via.placeholder.com/500x500?text=Balyqueen"
            ];

        }


        card.innerHTML = `

            <div class="product-images">

                <img
                    src="${images[0]}"
                    alt="${escapeHTML(product.name)}"
                    class="main-product-image"
                    id="main-image-${product.id}"
                >

                ${
                    images.length > 1
                    ? `
                        <div class="image-thumbnails">

                            ${images.map((image, index) => `
                                <img
                                    src="${image}"
                                    alt="${escapeHTML(product.name)}"
                                    class="image-thumbnail ${
                                        index === 0
                                        ? "active"
                                        : ""
                                    }"
                                    onclick="
                                        changeProductImage(
                                            ${product.id},
                                            '${image}',
                                            this
                                        )
                                    "
                                >
                            `).join("")}

                        </div>
                    `
                    : ""
                }

            </div>


            <div class="product-info">

                <h3>
                    ${escapeHTML(product.name)}
                </h3>

                ${
    product.sale_price
    ? `
        <p class="old-price">
            ₦${Number(product.price).toLocaleString()}
        </p>

        <p class="sale-price">
            ₦${Number(product.sale_price).toLocaleString()}
        </p>

        <span class="sale-badge">
            SALE
        </span>
    `
    : `
        <p class="price">
            ₦${Number(product.price).toLocaleString()}
        </p>
    `
                }

<p class="description">
    ${escapeHTML(product.description || "No description available.")}
</p>

                <p class="stock">
                    ${
                        product.stock > 0
                        ? product.stock + " available"
                        : "Out of stock"
                    }
                </p>

                <button
                    class="add-button"
                    onclick="addToCart(${product.id})"
                    ${product.stock <= 0 ? "disabled" : ""}
                >
                    ${
                        product.stock > 0
                        ? "Add to Cart"
                        : "Out of Stock"
                    }
                </button>

            </div>
        `;


        container.appendChild(card);

    });

}


/* =========================
   CHANGE PRODUCT IMAGE
========================= */

function changeProductImage(
    productId,
    image,
    thumbnail
) {

    const mainImage =
        document.getElementById(
            `main-image-${productId}`
        );

    if (!mainImage) {
        return;
    }

    mainImage.src = image;


    const thumbnails =
        thumbnail
            .parentElement
            .querySelectorAll(
                ".image-thumbnail"
            );

    thumbnails.forEach(item => {

        item.classList.remove("active");

    });


    thumbnail.classList.add("active");
}


/* =========================
   SEARCH + CATEGORY
========================= */

function filterProducts() {

    const search =
        document
        .getElementById("search")
        .value
        .toLowerCase()
        .trim();


    const category =
        document
        .getElementById("category")
        .value;


    const filtered =
        products.filter(product => {

            const matchesSearch =
                product.name
                .toLowerCase()
                .includes(search);


            const matchesCategory =
                category === "all" ||
                product.category === category;


            return (
                matchesSearch &&
                matchesCategory
            );

        });


    displayProducts(filtered);

}


/* =========================
   ADD TO CART
========================= */

function addToCart(id) {

    const product =
        products.find(
            item => item.id === id
        );


    if (!product || product.stock <= 0) {
        return;
    }


    const existing =
        cart.find(
            item => item.id === id
        );


    if (existing) {

        if (
            existing.quantity <
            product.stock
        ) {

            existing.quantity++;

        }

    } else {

        cart.push({

            id: product.id,

            name: product.name,

            price: product.price,

            quantity: 1,

            stock: product.stock

        });

    }


    saveCart();

    updateCart();

    alert(
        product.name +
        " added to your cart ❤️"
    );

}


/* =========================
   REMOVE FROM CART
========================= */

function removeFromCart(id) {

    cart =
        cart.filter(
            item => item.id !== id
        );

    saveCart();

    updateCart();

}


/* =========================
   CHANGE QUANTITY
========================= */

function changeQuantity(id, amount) {

    const item =
        cart.find(
            product => product.id === id
        );


    if (!item) return;


    const newQuantity =
        item.quantity + amount;


    if (newQuantity <= 0) {

        removeFromCart(id);

        return;
    }


    if (newQuantity > item.stock) {

        alert(
            "You cannot add more than the available stock."
        );

        return;
    }


    item.quantity =
        newQuantity;


    saveCart();

    updateCart();

}


/* =========================
   UPDATE CART
========================= */

function updateCart() {

    const container =
        document.getElementById(
            "cartItems"
        );


    container.innerHTML = "";


    let total = 0;

    let count = 0;


    cart.forEach(item => {

        const itemTotal =
            item.price *
            item.quantity;


        total += itemTotal;

        count += item.quantity;


        container.innerHTML += `

            <div class="cart-item">

                <div>

                    <strong>
                        ${escapeHTML(item.name)}
                    </strong>

                    <br>

                    ₦${Number(item.price).toLocaleString()}

                </div>


                <div>

                    <button
                        onclick="changeQuantity(
                            ${item.id},
                            -1
                        )"
                    >
                        −
                    </button>


                    ${item.quantity}


                    <button
                        onclick="changeQuantity(
                            ${item.id},
                            1
                        )"
                    >
                        +
                    </button>


                    <button
                        onclick="removeFromCart(
                            ${item.id}
                        )"
                    >
                        Remove
                    </button>

                </div>

            </div>

        `;

    });


    if (cart.length === 0) {

        container.innerHTML =
            "<p>Your cart is empty.</p>";

    }


    document.getElementById(
        "cartTotal"
    ).textContent =
        total.toLocaleString();


    document.getElementById(
        "cartCount"
    ).textContent =
        count;

}


/* =========================
   OPEN CART
========================= */

function openCart() {

    updateCart();

    document.getElementById(
        "cartModal"
    ).style.display = "block";

}


/* =========================
   CLOSE CART
========================= */

function closeCart() {

    document.getElementById(
        "cartModal"
    ).style.display = "none";

}


/* =========================
   CHECKOUT
========================= */

function checkout() {

    if (cart.length === 0) {

        alert(
            "Your cart is empty."
        );

        return;
    }


    closeCart();


    document.getElementById(
        "checkoutModal"
    ).style.display = "block";

}


/* =========================
   CLOSE CHECKOUT
========================= */

function closeCheckout() {

    document.getElementById(
        "checkoutModal"
    ).style.display = "none";

}


/* =========================
   PAYSTACK
========================= */

async function payNow() {

    const email =
        document
        .getElementById(
            "customerEmail"
        )
        .value
        .trim();


    const name =
        document
        .getElementById(
            "customerName"
        )
        .value
        .trim();


    const phone =
        document
        .getElementById(
            "customerPhone"
        )
        .value
        .trim();


    const address =
        document
        .getElementById(
            "customerAddress"
        )
        .value
        .trim();


    if (
        !email ||
        !name ||
        !phone ||
        !address
    ) {

        alert(
            "Please fill in all your details."
        );

        return;
    }


    const total =
        cart.reduce(
            (sum, item) =>
                sum +
                (
                    item.price *
                    item.quantity
                ),
            0
        );


    try {

        const button =
            document.querySelector(
                ".checkout-button"
            );


        button.disabled = true;

        button.textContent =
            "Processing...";


        const response =
            await fetch(
                "/api/pay",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        email,

                        name,

                        phone,

                        address,

                        items: cart,

                        amount: total

                    })

                }
            );


        const data =
            await response.json();


        if (
            data.status &&
            data.data &&
            data.data.authorization_url
        ) {

            window.location.href =
                data.data.authorization_url;

        } else {

            alert(
                data.message ||
                "Payment could not be started."
            );

        }


    } catch (error) {

        console.error(error);

        alert(
            "Something went wrong. Please try again."
        );

    }

}


/* =========================
   SAVE CART
========================= */

function saveCart() {

    localStorage.setItem(
        "balyqueen_cart",
        JSON.stringify(cart)
    );

}


/* =========================
   LOAD SAVED CART
========================= */

function loadCart() {

    try {

        const saved =
            localStorage.getItem(
                "balyqueen_cart"
            );


        if (saved) {

            cart =
                JSON.parse(saved);

        }

    } catch (error) {

        cart = [];

    }


    updateCart();

}


/* =========================
   BASIC HTML SAFETY
========================= */

function escapeHTML(value) {

    return String(value)

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}


/* =========================
   START
========================= */

loadCart();

loadProducts();