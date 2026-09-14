const params = new URLSearchParams(
    window.location.search
);

const productId = params.get("id");

const container =
    document.getElementById("product-details");


async function loadProduct() {

    try {

        if (!productId) {
            container.innerHTML =
                "<p>Product not found.</p>";
            return;
        }

        const response =
            await fetch("/api/products");

        const products =
            await response.json();

        const product =
            products.find(
                item =>
                    String(item.id) ===
                    String(productId)
            );

        if (!product) {
            container.innerHTML =
                "<p>Product not found.</p>";
            return;
        }

        let images = [];

        try {

            images =
                JSON.parse(product.image);

        } catch (error) {

            if (product.image) {
                images = [product.image];
            }

        }

        if (!images.length) {
            images = [
                "https://via.placeholder.com/500x500?text=Balyqueen"
            ];
        }


        container.innerHTML = `

            <div class="product-detail">

                <div class="detail-images">

                    <img
                        id="detail-main-image"
                        src="${images[0]}"
                        alt="${escapeHTML(product.name)}"
                    >

                    <div class="detail-thumbnails">

                        ${images.map((image, index) => `

                            <img
                                src="${image}"
                                class="detail-thumbnail ${
                                    index === 0
                                    ? "active"
                                    : ""
                                }"
                                onclick="changeDetailImage(
                                    '${image}',
                                    this
                                )"
                            >

                        `).join("")}

                    </div>

                </div>


                <div class="detail-info">

                    <h2>
                        ${escapeHTML(product.name)}
                    </h2>

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

                    <p class="detail-description">
                        ${escapeHTML(
                            product.description ||
                            "No description available."
                        )}
                    </p>

                    <p class="stock">
                        ${
                            product.stock > 0
                            ? product.stock + " available"
                            : "Out of stock"
                        }
                    </p>

                </div>

            </div>

        `;

    } catch (error) {

        console.error(
            "Product page error:",
            error
        );

        container.innerHTML =
            "<p>Unable to load product.</p>";

    }

}


function changeDetailImage(
    image,
    thumbnail
) {

    document.getElementById(
        "detail-main-image"
    ).src = image;

    document
        .querySelectorAll(
            ".detail-thumbnail"
        )
        .forEach(item => {

            item.classList.remove(
                "active"
            );

        });

    thumbnail.classList.add(
        "active"
    );

}


function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


loadProduct();