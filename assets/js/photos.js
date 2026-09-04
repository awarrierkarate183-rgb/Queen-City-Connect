window.QCCPhotos = (function () {
  const named = {
    "Nourish Up": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
    "Roof Above": "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
    "NAMI Charlotte": "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&q=80",
    "HandsOn Charlotte": "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
    "Discovery Place Science": "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&q=80",
    "Mint Museum": "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80",
    "Charlotte-Mecklenburg Library – Teen Volunteer": "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80",
    "ImaginOn: The Joe & Joan Martin Center": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
    "Bank of America Student Leaders": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
    "YMCA of Greater Charlotte – Teen Programs": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f149?w=800&q=80",
    "988 Suicide & Crisis Lifeline": "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=800&q=80",
    "Second Harvest Food Bank of Metrolina – Volunteer": "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80",
    "Humane Society of Charlotte": "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80",
    "Carolina Raptor Center": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80",
    "U.S. National Whitewater Center": "https://images.unsplash.com/photo-1472745942893-4b9f730c766e?w=800&q=80"
  };

  const pools = {
    Food: [
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
      "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80",
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80",
      "https://images.unsplash.com/photo-1601598851547-4302969d0614?w=800&q=80",
      "https://images.unsplash.com/photo-1547496502-affa22d38842?w=800&q=80",
      "https://images.unsplash.com/photo-1464224011240-4b0d0d4d0b0c?w=800&q=80"
    ],
    Housing: [
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=800&q=80",
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80",
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80"
    ],
    Health: [
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
      "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=800&q=80",
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80",
      "https://images.unsplash.com/photo-1551076805-e1869033bd1f?w=800&q=80"
    ],
    "Mental Health": [
      "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&q=80",
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80",
      "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=800&q=80",
      "https://images.unsplash.com/photo-1527137343708-debfe9edee96?w=800&q=80"
    ],
    Youth: [
      "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=800&q=80",
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
      "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=800&q=80",
      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f149?w=800&q=80",
      "https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=800&q=80"
    ],
    Volunteer: [
      "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
      "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80",
      "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80",
      "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80",
      "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800&q=80",
      "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80",
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80"
    ],
    Internships: [
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80",
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80",
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80"
    ],
    Employment: [
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80",
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80"
    ],
    Education: [
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80",
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80",
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80",
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80"
    ],
    Safety: [
      "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80",
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80",
      "https://images.unsplash.com/photo-1584433144859-1fc3ab64a957?w=800&q=80"
    ],
    "Legal Aid": [
      "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=800&q=80",
      "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80",
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80"
    ],
    "Financial Aid": [
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
      "https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?w=800&q=80",
      "https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?w=800&q=80"
    ],
    Veterans: [
      "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=800&q=80",
      "https://images.unsplash.com/photo-1541199249251-f713e6145474?w=800&q=80"
    ],
    "General Support": [
      "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80",
      "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80",
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&q=80"
    ]
  };

  function hashName(name) {
    let h = 2166136261;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function forResource(resource) {
    const name = resource && resource.name;
    if (named[name]) return named[name];
    const pool = pools[resource && resource.category] || pools['General Support'];
    return pool[hashName(name) % pool.length];
  }

  return { forResource, named };
})();
