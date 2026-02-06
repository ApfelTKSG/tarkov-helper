
// using built-in fetch

const query = `
{
  hideoutStations {
    id
    name
    levels {
      level
      itemRequirements {
        item {
          id
          name
        }
        count
        isFoundsInRaid
      }
      stationLevelRequirements {
        station {
          name
        }
        level
      }
      traderRequirements {
        trader {
          name
        }
        level
      }
    }
  }
  traders {
    id
    name
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
            const text = await response.text();
            console.error('Response body:', text);
            return;
        }

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchData();
