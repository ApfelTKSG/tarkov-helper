// const fetch = require('node-fetch');

async function checkSchema() {
  const query = `
    query {
        __type(name: "ItemAttribute") {
            fields {
                name
                type {
                    name
                }
            }
        }
    }
  `;

  try {
    const response = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    const fields = result.data.__type.fields.map(f => f.name);
    console.log('ItemAttribute Fields:', fields);
  } catch (error) {
    console.error(error);
  }
}

checkSchema();
