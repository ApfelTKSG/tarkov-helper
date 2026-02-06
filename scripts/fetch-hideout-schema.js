
const fs = require('fs');

const query = `
{
  __type(name: "HideoutStation") {
    name
    fields {
      name
      type {
        name
        kind
        ofType {
          name
          kind
        }
      }
    }
  }
  HideoutStationLevel: __type(name: "HideoutStationLevel") {
    name
    fields {
      name
      type {
        name
        kind
        ofType {
          name
          kind
        }
      }
    }
  }
  Requirement: __type(name: "Requirement") {
    name
    kind
    possibleTypes {
      name
      kind
    }
  }
  Trader: __type(name: "Trader") {
    name
    fields {
      name
      type {
        name
        kind
      }
    }
  }
  TraderLevel: __type(name: "TraderLevel") {
    name
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}
`;

async function fetchData() {
  try {
    const response = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error('HTTP Error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    fs.writeFileSync('schema_dump.json', JSON.stringify(data, null, 2));
    console.log('Schema dumped to schema_dump.json');
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();
