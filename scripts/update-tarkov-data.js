
const fs = require('fs');
const path = require('path');

const query = `
{
  hideoutStations {
    id
    name
    normalizedName
    # imageLink
    levels {
      id
      level
      constructionTime
      # description
      itemRequirements {
        item {
          id
          name
          shortName
          iconLink
          wikiLink
          avg24hPrice
          weight
          width
          height
        }
        count

        attributes {
            name
            value
        }
      }
      stationLevelRequirements {
        station {
          id
          normalizedName
          name
        }
        level
      }
      traderRequirements {
        trader {
          id
          normalizedName
          name
        }
        level
      }
      skillRequirements {
        skill {
          name
        }
        level
      }
    }
  }
  traders {
    id
    name
    normalizedName
    # imageLink
    levels {
      level
      requiredPlayerLevel
      requiredReputation
      requiredCommerce
    }
  }
}
`;

async function fetchData() {
  console.log('Fetching data from Tarkov API...');
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

    const json = await response.json();

    if (json.errors) {
      console.error('GraphQL Errors:', JSON.stringify(json.errors, null, 2));
    }

    const data = json.data;

    if (!data) {
      console.error('No data returned from API');
      return;
    }

    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }

    if (data.hideoutStations) {
      fs.writeFileSync(path.join(dataDir, 'hideout.json'), JSON.stringify(data.hideoutStations, null, 2));
      console.log('Saved data/hideout.json');
    }

    if (data.traders) {
      fs.writeFileSync(path.join(dataDir, 'traders.json'), JSON.stringify(data.traders, null, 2));
      console.log('Saved data/traders.json');
    }

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();
