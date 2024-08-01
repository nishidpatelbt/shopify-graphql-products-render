require('dotenv').config();
const fetch = require('node-fetch');

// Shopify Store Info from environment variables
const { SHOPIFY_STORE_URL: domain, SHOPIFY_STOREFRONT_ACCESS_TOKEN: storefrontToken, API_VERSION: ApiVersion } = process.env;

// GraphQL Query
const productQuery = `
  query products($name: String!, $productCursor: String, $variantCursor: String) {
    products(first: 250, after: $productCursor, query: $name) {
      edges {
        cursor
        node {
          title
          variants(first: 20, after: $variantCursor) {
            edges {
              cursor
              node {
                title
                price
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

// Function to perform GraphQL queries
async function fetchFromShopify(query, variables) {
  const url = `${domain}/admin/api/${ApiVersion}/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': storefrontToken,
    },
    body: JSON.stringify({
      query: query,
      variables: variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return await response.json();
}

// Function to fetch and process products and their variants
async function fetchProducts(name) {
  let productCursor = null;
  let allProducts = [];

  do {
    const variables = { name: `title:*${name}*`, productCursor, variantCursor: null };
    const responseData = await fetchFromShopify(productQuery, variables);

    const products = responseData.data.products.edges;
    for (const product of products) {
      const productName = product.node.title;
      let productVariants = [];

      const variants = product.node.variants.edges;
      variants.forEach(variant => {
        const variantName = variant.node.title;
        const variantPrice = variant.node.price;
        productVariants.push({
          productName,
          variantName,
          variantPrice
        });
      });

      allProducts.push(...productVariants);
    }

    const pageInfo = responseData.data.products.pageInfo;
    productCursor = pageInfo.hasNextPage ? products[products.length - 1].cursor : null;

  } while (productCursor);
    allProducts.sort((a, b) => parseFloat(a.variantPrice) - parseFloat(b.variantPrice));
    allProducts.forEach(item => {
    console.log(`${item.productName} - ${item.variantName} - $${parseInt(item.variantPrice)}`);
  });
}

// Running the script
const productName = process.argv[3];
if (!productName) {
  console.error('Please provide a product name as argument.');
} else {
  fetchProducts(productName).catch(error => console.error(error));
}
