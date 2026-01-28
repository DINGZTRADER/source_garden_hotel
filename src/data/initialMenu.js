export const INITIAL_MENU = [
    // Breakfast
    { id: 'brk_1', name: 'Spanish Omelette', price: 15000, category: 'Breakfast', type: 'kitchen' },
    { id: 'brk_2', name: 'Fried Eggs (Pair)', price: 8000, category: 'Breakfast', type: 'kitchen' },
    { id: 'brk_3', name: 'Poached Eggs', price: 8000, category: 'Breakfast', type: 'kitchen' },
    { id: 'brk_4', name: 'Scrambled Eggs', price: 8000, category: 'Breakfast', type: 'kitchen' },
    { id: 'brk_5', name: 'Full English Breakfast', price: 35000, category: 'Breakfast', type: 'kitchen' },
    { id: 'brk_6', name: 'African Tea (Pot)', price: 10000, category: 'Breakfast', type: 'kitchen' },
    // Soups
    { id: 'soup_1', name: 'Clear Vegetable Soup', price: 10000, category: 'Soups', type: 'kitchen' },
    { id: 'soup_2', name: 'Cream of Mushroom', price: 15000, category: 'Soups', type: 'kitchen' },
    { id: 'soup_3', name: 'Chicken Soup', price: 18000, category: 'Soups', type: 'kitchen' },
    // Starters
    { id: 'start_1', name: 'Chefs Caesar Salad', price: 25000, category: 'Starters', type: 'kitchen' },
    { id: 'start_2', name: 'Chicken Salad', price: 25000, category: 'Starters', type: 'kitchen' },
    { id: 'start_3', name: 'Garden Salad', price: 15000, category: 'Starters', type: 'kitchen' },
    // Snacks
    { id: 'snk_1', name: 'Beef Samosas (Pair)', price: 5000, category: 'Snacks', type: 'kitchen' },
    { id: 'snk_2', name: 'Chicken Wings (6pcs)', price: 20000, category: 'Snacks', type: 'kitchen' },
    { id: 'snk_3', name: 'Plain Chips (Fries)', price: 8000, category: 'Snacks', type: 'kitchen' },
    { id: 'snk_4', name: 'Masala Chips', price: 12000, category: 'Snacks', type: 'kitchen' },
    { id: 'snk_5', name: 'Club Sandwich', price: 25000, category: 'Snacks', type: 'kitchen' },
    { id: 'snk_6', name: 'Beef Burger', price: 25000, category: 'Snacks', type: 'kitchen' },
    // Main Course
    { id: 'main_1', name: 'Pepper Steak', price: 35000, category: 'Main Course', type: 'kitchen' },
    { id: 'main_2', name: 'Grilled Tilapia Fillet', price: 35000, category: 'Main Course', type: 'kitchen' },
    { id: 'main_3', name: 'Grilled Chicken Breast', price: 35000, category: 'Main Course', type: 'kitchen' },
    { id: 'main_4', name: 'Pork Chops', price: 35000, category: 'Main Course', type: 'kitchen' },
    { id: 'main_5', name: 'Mixed Grill Platter', price: 55000, category: 'Main Course', type: 'kitchen' },
    { id: 'main_6', name: 'Fish & Chips', price: 30000, category: 'Main Course', type: 'kitchen' },
    // Pizza & Pasta
    { id: 'it_1', name: 'Spaghetti Bolognaise', price: 28000, category: 'Pizza & Pasta', type: 'kitchen' },
    { id: 'it_2', name: 'Pizza Margherita', price: 25000, category: 'Pizza & Pasta', type: 'kitchen' },
    { id: 'it_3', name: 'Pizza Chicken', price: 35000, category: 'Pizza & Pasta', type: 'kitchen' },
    // African
    { id: 'afr_1', name: 'Matooke & G-Nut Sauce', price: 15000, category: 'African', type: 'kitchen' },
    { id: 'afr_2', name: 'Local Chicken Stew', price: 35000, category: 'African', type: 'kitchen' },
    { id: 'afr_3', name: 'Goat Pilau', price: 25000, category: 'African', type: 'kitchen' },
    // Desserts
    { id: 'des_1', name: 'Fruit Salad', price: 10000, category: 'Desserts', type: 'kitchen' },
    { id: 'des_2', name: 'Ice Cream (2 Scoops)', price: 8000, category: 'Desserts', type: 'kitchen' },
    // Beverages
    { id: 'juice_1', name: 'Fresh Passion Juice', price: 8000, category: 'Fresh Juices', type: 'bar', stock_open: 0 },
    { id: 'juice_2', name: 'Fresh Watermelon', price: 8000, category: 'Fresh Juices', type: 'bar', stock_open: 0 },
    // Beers & Sodas
    { id: 'beer1', name: 'Nile Special', price: 5000, category: 'Beers & Sodas', type: 'bar', stock_open: 48 },
    { id: 'beer2', name: 'Club Pilsner', price: 5000, category: 'Beers & Sodas', type: 'bar', stock_open: 48 },
    { id: 'soda1', name: 'Soda (300ml)', price: 3000, category: 'Beers & Sodas', type: 'bar', stock_open: 72 },
    { id: 'wtr1', name: 'Mineral Water (500ml)', price: 2000, category: 'Beers & Sodas', type: 'bar', stock_open: 100 },
    // Spirits
    { id: 'alc1', name: 'Uganda Waragi (750ml)', price: 30000, category: 'Spirits', type: 'bar', stock_open: 10 },
    { id: 'alc2', name: 'Jameson (750ml)', price: 180000, category: 'Spirits', type: 'bar', stock_open: 8 },
    // Services
    { id: 'hc1', name: 'Deep Tissue Massage', price: 80000, category: 'Health Club', type: 'service' },
    { id: 'hc2', name: 'Sauna/Steam', price: 20000, category: 'Health Club', type: 'service' },
    { id: 'pl1', name: 'Swimming (Adult)', price: 20000, category: 'Pool', type: 'service' },
    // Laundry Services (Front Office Department)
    { id: 'ld1', name: 'Wash & Iron (Shirt)', price: 5000, category: 'FO Laundry', type: 'fo_service', department: 'fo' },
    { id: 'ld2', name: 'Wash & Iron (Trousers)', price: 6000, category: 'FO Laundry', type: 'fo_service', department: 'fo' },
    { id: 'ld3', name: 'Wash & Iron (Dress)', price: 8000, category: 'FO Laundry', type: 'fo_service', department: 'fo' },
    { id: 'ld4', name: 'Wash & Iron (Suit)', price: 15000, category: 'FO Laundry', type: 'fo_service', department: 'fo' },
    { id: 'ld5', name: 'Dry Clean (Suit)', price: 25000, category: 'FO Laundry', type: 'fo_service', department: 'fo' },
    { id: 'ld6', name: 'Ironing Only (per piece)', price: 2000, category: 'FO Laundry', type: 'fo_service', department: 'fo' },
];
