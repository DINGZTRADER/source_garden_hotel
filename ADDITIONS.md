**Situation**
You are integrating operational management additions into an existing Source Garden Hotel HMS system. The hotel operates 5 service centers: Main Bar, Riverside Bar, New Kitchen, Health Club, and Swimming Pool Bar, with an overall supervisor overseeing operations. These new modules must integrate seamlessly with existing HMS functionality to streamline stock management from centralized procurement through to service delivery, while simultaneously tracking individual staff performance and reducing financial losses through improved inventory visibility and theft prevention.

**Task**
Design and specify the following additions to the existing HMS:

1. Relocate laundry operations to the front office department
2. Establish a purchase entry module that records all goods purchased from external suppliers, capturing supplier details, item descriptions, quantities, costs, and delivery dates
3. Establish digital stock management across three tiers: main store, individual bars, and kitchen facilities, with dedicated stock sheets for each tier tracking items received from suppliers and items issued to service centers
4. Implement a mandatory digital requisition system that tracks all item movements between the main store and service centers (Main Bar, Riverside Bar, New Kitchen, Health Club, Swimming Pool Bar)
5. Create shift management logic that automatically starts and ends staff shifts based on system login/logout events, with admin/owner access to view all service staff login details and shift records
6. Implement order tracking that attributes all bar and kitchen orders to the specific staff member who placed them, recording their name and creating an audit trail
7. Establish performance tracking and monthly sales targets for service staff (2 service staff at Main Bar, Riverside Bar, and New Kitchen; 1 barperson at Health Club and Swimming Pool Bar)

**Objective**
Enhance the existing HMS with operational efficiency improvements, improved management information systems, enhanced financial awareness, reduced theft and losses, minimized food and drink waste through better inventory tracking, monitored staff productivity and sales performance, and streamlined ordering between service centers and the main store. The additions should provide real-time inventory visibility, ensure accountability at individual staff level, and generate actionable performance data to support management decision-making and staff evaluation.

**Knowledge**
- Service outlets: Main Bar (1 barperson, 2 service staff), Riverside Bar (1 barperson, 2 service staff), New Kitchen (1 barperson, 2 service staff), Health Club (1 barperson), Swimming Pool Bar (1 barperson), plus 1 overall supervisor
- Stock items include drinks (perishable and non-perishable) and restaurant items (perishable and non-perishable)
- All goods purchased are centralized in the main store before distribution to service centers
- Service centers receive items only through formal digital requisition requests
- The main store requires its own stock sheets tracking both items received from suppliers and items issued to different service centers
- Menu items should inform the structure and content of kitchen stock sheets
- Digital requisition system is mandatory (not manual or paper-based)
- System must track: items issued, items received, requisition dates/times, requesting staff member, authorizing staff member, and quantities
- Purchase entry module must capture: supplier name, item descriptions, quantities purchased, unit costs, total cost, delivery dates, and receipt confirmation
- Performance tracking should monitor staff productivity and sales performance to support monthly sales targets and staff evaluation
- The system should create an audit trail for all transactions to support loss reduction and theft prevention initiatives
- Admin/owner must have access to view all service staff login details, including login times, logout times, and shift duration across all service centers
- These additions must integrate with existing HMS workflows and data structures without disrupting current operations

**Behavioral Rules**
The assistant should:
1. Design the stock management additions with three distinct stock sheet tiers (main store, service centers, kitchen) that clearly show item flow from procurement through to service delivery and integrate with existing HMS inventory modules
2. Ensure the purchase entry module provides a dedicated interface for recording all external supplier purchases, with fields for supplier information, item details, quantities, costs, and delivery dates, integrating seamlessly with the main store stock sheet
3. Ensure the digital requisition system captures the requesting staff member's identity, timestamp, items requested, quantities, and approval status to create accountability, and specify how this integrates with existing purchase order and inventory systems
4. Implement shift logic that records login/logout times for each staff member and automatically calculates shift duration and performance metrics during that shift, utilizing existing HMS staff management features, with a dedicated admin/owner dashboard displaying all service staff login details and shift records across all outlets
5. Create order attribution that links every bar and kitchen order to the specific staff member who placed it, enabling individual performance tracking and monthly sales target monitoring through existing HMS point-of-sale systems
6. Design performance metrics that track staff productivity, sales performance, and other relevant targets that can be reviewed monthly and used for staff evaluation, integrating with existing HMS reporting capabilities

**System Architecture Considerations**
When designing these additions, address the following edge cases and implementation details:
- Ensure the purchase entry module links directly to the main store stock sheet so that purchased items automatically update available inventory upon receipt confirmation
- Ensure the main store stock sheets clearly differentiate between items received from external suppliers versus items issued to internal service centers
- Design requisition workflows that prevent stock-outs by alerting management when inventory falls below minimum thresholds
- Create role-based access controls so that bar staff can only requisition items appropriate to their outlet, and only authorized personnel can approve requisitions
- Build in reconciliation processes where physical stock counts are compared against digital records to identify discrepancies and prevent losses
- Design the shift management system to handle login/logout anomalies (e.g., forgotten logouts, system crashes) with manual override capabilities for supervisors
- Ensure admin/owner can access comprehensive staff login records including timestamps, shift duration, and attendance patterns to monitor staff presence and accountability across all service centers
- Ensure order tracking captures not just sales but also voids, returns, and complimentary items to provide accurate performance metrics
- Create a dashboard for the overall supervisor that provides real-time visibility into inventory levels, staff performance, financial metrics, staff login details, and purchase history across all outlets
- Specify integration points with existing HMS modules to ensure data consistency and minimize duplicate data entry