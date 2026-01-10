<!doctype html>
<html lang="en" class="h-full">
 <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Customers &amp; Marketing</title>
  <script src="/_sdk/element_sdk.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
  <style>
    body {
      box-sizing: border-box;
    }

    
    * {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    .cta-button {
      transition: all 0.3s ease;
    }
    
    .cta-button:hover {
      transform: scale(1.05);
      box-shadow: 0 10px 30px rgba(168, 85, 247, 0.5);
    }
    
    .gradient-text {
      background: linear-gradient(135deg, #db2777 0%, #a855f7 50%, #7c3aed 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .nav-tab {
      transition: all 0.3s ease;
    }
    
    .nav-tab:hover {
      background: rgba(255, 255, 255, 0.95);
      color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.95);
    }
    
    .nav-tab:active {
      transform: translateY(0px);
    }
    
    .nav-tab.active {
      background: rgba(255, 255, 255, 0.95);
      color: #667eea;
      border-color: rgba(255, 255, 255, 0.95);
    }
    
    .feature-card {
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .feature-card:hover {
      transform: translateY(-12px) scale(1.02);
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-20px); }
    }
    
    .float-animation {
      animation: float 6s ease-in-out infinite;
    }
    
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(236, 72, 153, 0.3); }
      50% { box-shadow: 0 0 40px rgba(236, 72, 153, 0.6); }
    }
    
    /* Customer page specific styles */
    .loyalty {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .loyalty.gold { background: #fef3c7; color: #92400e; }
    .loyalty.silver { background: #f3f4f6; color: #374151; }
    .loyalty.bronze { background: #fed7aa; color: #9a3412; }
    .loyalty.vip { background: #ddd6fe; color: #5b21b6; }
    
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .status-badge.paid { background: #d1fae5; color: #065f46; }
    .status-badge.refunded { background: #fee2e2; color: #991b1b; }
    .status-badge.cancelled { background: #f3f4f6; color: #374151; }
    
    .tag {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: #e0e7ff;
      color: #3730a3;
    }
    
    .kebab {
      position: relative;
    }
    
    .kebab .menu {
      display: none;
      position: absolute;
      right: 0;
      top: 100%;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      min-width: 160px;
      z-index: 100;
      margin-top: 4px;
    }
    
    .kebab .menu.open {
      display: block;
    }
    
    .kebab .menu a {
      display: block;
      padding: 10px 14px;
      color: #2d3748;
      text-decoration: none;
      font-size: 14px;
      transition: background 0.2s ease;
    }
    
    .kebab .menu a:hover {
      background: #f7fafc;
    }
    
    .kebab .menu a:first-child {
      border-radius: 8px 8px 0 0;
    }
    
    .kebab .menu a:last-child {
      border-radius: 0 0 8px 8px;
    }
    
    .mini-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    
    .mini-card {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    
    .drawer-section {
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .drawer-section:last-child {
      border-bottom: none;
    }
    
    .drawer-section .title {
      font-size: 16px;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 12px;
    }
    
    #customerDrawerOverlay.open {
      display: block !important;
    }
    
    #customerDrawer.open {
      right: 0 !important;
    }
    
    .btn {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      transition: all 0.2s ease;
    }
    
    .btn:hover {
      background: #edf2f7;
      border-color: #cbd5e0;
    }
    
    .btn.p {
      background: #a855f7;
      color: white;
      border-color: #a855f7;
    }
    
    .btn.p:hover {
      background: #9333ea;
      border-color: #9333ea;
    }
    
    .date-filter-option:hover {
      background: #f7fafc !important;
      border-color: #cbd5e0 !important;
    }
    
    #applyCustomDate:hover {
      background: #9333ea;
    }
    
    #clearDateFilter:hover {
      background: #edf2f7;
      border-color: #cbd5e0;
    }
    
    [data-sort] svg {
      transition: transform 0.3s ease;
    }
  </style>
  <style>@view-transition { navigation: auto; }</style>
  <script src="/_sdk/data_sdk.js" type="text/javascript"></script>
 </head>
 <body class="h-full w-full overflow-auto" style="margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100%;">
  <div class="w-full" style="padding: 60px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100%;"><!-- Header Section -->
   <div style="text-align: center; margin-bottom: 60px;">
    <h1 id="main-title" style="font-size: clamp(32px, 5vw, 72px); font-weight: 800; margin: 0; color: #ffffff; line-height: 1.1; transition: opacity 0.4s ease; min-height: 160px; display: flex; align-items: center; justify-content: center; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);">Intelligent Marketing and Powerful Automations</h1><!-- Navigation Tabs -->
    <div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;"><button class="nav-tab" data-page="customers" style="background: rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid rgba(255, 255, 255, 0.4); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(10px);"> Customers </button> <button class="nav-tab" data-page="email-campaigns" style="background: rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid rgba(255, 255, 255, 0.4); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(10px);"> Email Campaigns </button> <button class="nav-tab" data-page="marketing" style="background: rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid rgba(255, 255, 255, 0.4); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(10px);"> Social Media Campaigns </button> <button class="nav-tab" data-page="imports" style="background: rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid rgba(255, 255, 255, 0.4); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(10px);"> Imports &amp; Exports </button> <button class="nav-tab" data-page="add-subscriber" style="background: rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid rgba(255, 255, 255, 0.4); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(10px);"> Add Customer </button>
    </div>
    <p id="subtitle" style="font-size: 20px; color: #ffffff; margin: 0; transition: opacity 0.4s ease; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);">Manage your customer relationships and create powerful marketing campaigns that convert</p>
   </div><!-- Main Content Area -->
   <div id="content-area"><!-- Overview Page (Default) -->
    <div id="overview-page"><!-- CTA Section -->
     <div style="text-align: center; max-width: 700px; margin: 0 auto; background: rgba(255, 255, 255, 0.95); padding: 48px 40px; border-radius: 24px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1); border: 2px solid rgba(255, 255, 255, 0.3); backdrop-filter: blur(10px);">
      <h2 id="cta-heading" style="font-size: 40px; font-weight: 700; margin: 0 0 16px 0; color: #2d3748;">Start Growing Your Audience</h2>
      <p id="cta-description" style="font-size: 18px; color: #4a5568; margin: 0 0 32px 0; line-height: 1.6;">Transform browsers into buyers and customers into champions. Our all-in-one marketing platform gives you everything you need to connect, engage, and convert.</p><button id="cta-button" class="cta-button" style="background: #a855f7; color: white; font-size: 20px; font-weight: 600; padding: 18px 48px; border: none; border-radius: 12px; cursor: pointer;">Get Started</button>
     </div>
    </div><!-- Customers Page -->
    <div id="customers-page" style="display: none;">
     <div style="background: rgba(255, 255, 255, 0.95); padding: 32px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); max-width: 100%; backdrop-filter: blur(10px);"><!-- Header -->
      <div style="margin-bottom: 24px;">
       <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
         <h2 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: #2d3748;">Customers</h2>
         <p style="font-size: 14px; color: #718096; margin: 0;">Relationship-focused overview of people who keep coming back.</p>
        </div><!-- Filters Row -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;"><input id="customerSearch" type="text" placeholder="Search name, email, order ref, customer ID" style="flex: 1; min-width: 220px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;"> <select id="customerShowFilter" style="min-width: 190px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif; background: white;"> <option value="">All live shows</option> </select> <select id="customerDateRange" style="min-width: 150px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif; background: white;"> <option value="30">Last 30 days</option> <option value="90">Last 90 days</option> <option value="365">Last 365 days</option> <option value="any">All time</option> </select> <select id="customerStatus" style="min-width: 170px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif; background: white;"> <option value="any">Any status</option> <option value="PAID">Paid</option> <option value="REFUNDED">Refunded</option> <option value="CANCELLED">Cancelled</option> </select>
        </div>
       </div>
      </div>
      <div style="font-size: 13px; color: #718096; margin: 0 0 16px 0;">
       One row per customer, grouped across orders.
      </div><!-- Table -->
      <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
       <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
         <tr style="background: #f7fafc; border-bottom: 2px solid #e2e8f0;">
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Customer</th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Customer ID</th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Contact</th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">
           <div style="display: flex; align-items: center; gap: 8px;"><span>Total orders</span> <button data-sort="totalOrders" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; color: #718096; transition: color 0.2s;">
             <svg width="14" height="14" viewbox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2L7 12M7 2L4 5M7 2L10 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
             </svg></button>
           </div></th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">
           <div style="display: flex; align-items: center; gap: 8px;"><span>Total tickets</span> <button data-sort="totalTickets" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; color: #718096; transition: color 0.2s;">
             <svg width="14" height="14" viewbox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2L7 12M7 2L4 5M7 2L10 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
             </svg></button>
           </div></th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">
           <div style="display: flex; align-items: center; gap: 8px;"><span>Shows bought</span> <button data-sort="shows" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; color: #718096; transition: color 0.2s;">
             <svg width="14" height="14" viewbox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2L7 12M7 2L4 5M7 2L10 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
             </svg></button>
           </div></th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">
           <div style="display: flex; align-items: center; gap: 8px;"><span>Total spend</span> <button data-sort="totalSpend" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; color: #718096; transition: color 0.2s;">
             <svg width="14" height="14" viewbox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2L7 12M7 2L4 5M7 2L10 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
             </svg></button>
           </div></th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748; position: relative;">
           <div style="display: flex; align-items: center; gap: 8px;"><span>Last purchase</span> <button data-sort="lastPurchase" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; color: #718096; transition: color 0.2s;">
             <svg width="14" height="14" viewbox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2L7 12M7 2L4 5M7 2L10 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
             </svg></button> <button id="dateFilterToggle" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; color: #718096; transition: color 0.2s;">
             <svg width="16" height="16" viewbox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.5" fill="none" /> <line x1="1" y1="6" x2="15" y2="6" stroke="currentColor" stroke-width="1.5" /> <line x1="4.5" y1="1" x2="4.5" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /> <line x1="11.5" y1="1" x2="11.5" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /> <circle cx="4.5" cy="9" r="0.8" fill="currentColor" /> <circle cx="8" cy="9" r="0.8" fill="currentColor" /> <circle cx="11.5" cy="9" r="0.8" fill="currentColor" /> <circle cx="4.5" cy="12" r="0.8" fill="currentColor" /> <circle cx="8" cy="12" r="0.8" fill="currentColor" /> <circle cx="11.5" cy="12" r="0.8" fill="currentColor" />
             </svg></button>
           </div><!-- Date Filter Dropdown -->
           <div id="dateFilterMenu" style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); min-width: 280px; z-index: 1000; margin-top: 4px; padding: 12px;">
            <div style="font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 8px;">
             Filter by date
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;"><button data-date-filter="30" class="date-filter-option" style="text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; cursor: pointer; font-size: 13px; transition: all 0.2s; font-family: 'Outfit', sans-serif;">Last 30 days</button> <button data-date-filter="90" class="date-filter-option" style="text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; cursor: pointer; font-size: 13px; transition: all 0.2s; font-family: 'Outfit', sans-serif;">Last 90 days</button> <button data-date-filter="180" class="date-filter-option" style="text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; cursor: pointer; font-size: 13px; transition: all 0.2s; font-family: 'Outfit', sans-serif;">Last 6 months</button> <button data-date-filter="365" class="date-filter-option" style="text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; cursor: pointer; font-size: 13px; transition: all 0.2s; font-family: 'Outfit', sans-serif;">Last year</button>
             <div style="border-top: 1px solid #e2e8f0; margin: 6px 0; padding-top: 6px;">
              <div style="font-size: 12px; color: #718096; margin-bottom: 6px;">
               Custom range
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;"><input type="date" id="dateFrom" style="padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-family: 'Outfit', sans-serif;"> <input type="date" id="dateTo" style="padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-family: 'Outfit', sans-serif;"> <button id="applyCustomDate" style="padding: 6px 12px; background: #a855f7; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Outfit', sans-serif; transition: background 0.2s;">Apply</button>
              </div>
             </div><button id="clearDateFilter" style="padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f7fafc; cursor: pointer; font-size: 13px; font-weight: 600; color: #718096; font-family: 'Outfit', sans-serif; transition: all 0.2s;">Clear filter</button>
            </div>
           </div></th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Last show purchase for</th>
          <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;"></th>
         </tr>
        </thead>
        <tbody id="customerTableBody"><!-- Customer rows will be added here by your backend -->
        </tbody>
       </table>
      </div><!-- Empty State -->
      <div id="customerEmpty" style="display: none; margin-top: 20px; text-align: center; color: #718096; font-size: 14px;">
       No customers yet. Customer data will appear here when you start selling tickets.
      </div>
     </div><!-- Drawer Overlay -->
     <div id="customerDrawerOverlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 999; transition: opacity 0.3s ease;"></div><!-- Customer Drawer -->
     <aside id="customerDrawer" style="position: fixed; top: 0; right: -500px; width: 500px; max-width: 90vw; height: 100%; background: white; box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15); z-index: 1000; transition: right 0.3s ease; overflow-y: auto;">
      <div style="padding: 24px; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: white; z-index: 10;">
       <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div>
         <div id="drawerName" style="font-size: 24px; font-weight: 700; color: #2d3748; margin: 0 0 4px 0;">
          Customer
         </div>
         <div id="drawerMeta" style="font-size: 13px; color: #718096;"></div>
        </div><button id="drawerClose" style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 16px; font-size: 14px; font-weight: 600; color: #4a5568; cursor: pointer; font-family: 'Outfit', sans-serif; transition: all 0.2s ease;">Close</button>
       </div>
      </div>
      <div id="customerDrawerBody" style="padding: 24px;"><!-- Drawer content will be added here by your backend -->
      </div>
     </aside>
    </div><!-- Marketing Page -->
    <div id="marketing-page" style="display: none;">
     <div style="max-width: 1100px; margin: 0 auto;"><!-- Hero Section with Split Layout -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 48px 56px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); margin-bottom: 40px; position: relative; overflow: hidden;"><!-- Decorative background elements -->
       <div style="position: absolute; top: -50px; right: -50px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%); border-radius: 50%;"></div>
       <div style="position: absolute; bottom: -80px; left: -80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%); border-radius: 50%;"></div>
       <div style="position: relative; z-index: 1; max-width: 900px; margin: 0 auto;"><!-- Title and Badge Row -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; margin-bottom: 24px; flex-wrap: wrap;">
         <h2 style="font-size: 42px; font-weight: 900; margin: 0; color: #ffffff; line-height: 1.2; text-align: left; flex: 1; min-width: 280px;">Social Content Created<br>
          At The Click Of A Button</h2><span style="display: inline-flex; align-items: center; gap: 9px; background: rgba(236, 72, 153, 0.25); border: 2px solid rgba(236, 72, 153, 0.5); padding: 9px 24px; border-radius: 50px; backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(236, 72, 153, 0.2); white-space: nowrap;">
          <svg width="24" height="24" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" /> <circle cx="13" cy="10" r="1.5" fill="#ec4899" />
          </svg><span style="background: linear-gradient(135deg, #ffffff 0%, #fce7f3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 900; font-size: 15px;">AI-Powered</span> </span>
        </div><!-- Description -->
        <p style="font-size: 18px; color: #cbd5e1; margin: 0 0 32px 0; line-height: 1.7; max-width: 750px;">Generate scroll-stopping content for every show instantly. When tickets aren't moving, get AI-powered suggestions and create fresh posts in seconds—all connected to your live performance data.</p><!-- CTA Button -->
        <div><button id="launchSocialBuilder" class="cta-button" style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; font-size: 17px; font-weight: 700; padding: 16px 36px; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.25); transition: all 0.3s ease;"> Launch Social Builder → </button>
        </div>
       </div>
      </div><!-- Features Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 50px;">
       <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><rect x="2" y="2" width="20" height="20" rx="3" stroke="#ec4899" stroke-width="1.5" fill="none" /> <circle cx="12" cy="10" r="3" stroke="#ec4899" stroke-width="1.5" fill="none" /> <path d="M6 18c0-2 2-3.5 6-3.5s6 1.5 6 3.5" stroke="#ec4899" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">One-Click Show Campaigns</h4>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0 0 12px 0; line-height: 1.7;">Create a complete social media campaign the moment you add a show. Graphics, captions, hashtags—everything ready to post.</p>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 8px; font-size: 12px; color: #fce7f3; font-weight: 600;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="#fce7f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" /> <circle cx="13" cy="10" r="1.5" fill="#ec4899" />
         </svg><span>Instant content generation</span>
        </div>
       </div>
       <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease; grid-row: span 2;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="#ec4899" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /> <circle cx="9" cy="11" r="1" fill="#ec4899" /> <circle cx="12" cy="11" r="1" fill="#ec4899" /> <circle cx="15" cy="11" r="1" fill="#ec4899" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Intelligent Performance Insights</h4>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 8px; font-size: 12px; color: #fce7f3; font-weight: 600; margin-bottom: 12px;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="#fce7f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" /> <circle cx="13" cy="10" r="1.5" fill="#ec4899" />
         </svg><span>Real-time sales tracking</span>
        </div>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0 0 24px 0; line-height: 1.7;">Your social campaigns connect directly to ticket sales data. See which posts drive bookings, track engagement, and measure ROI.</p>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0; line-height: 1.7;">AI analyzes underperforming shows and suggests new angles, messaging, and creative approaches to boost sales. Get notified when it's time to create fresh content that converts.</p>
       </div>
       <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="#ec4899" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Smart Content Refresh</h4>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0 0 12px 0; line-height: 1.7;">Show not selling? Hit refresh and get brand new post ideas, angles, and creative concepts in seconds.</p>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 8px; font-size: 12px; color: #fce7f3; font-weight: 600;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="#fce7f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" /> <circle cx="13" cy="10" r="1.5" fill="#ec4899" />
         </svg><span>Endless variations</span>
        </div>
       </div>
       <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><rect x="2" y="7" width="20" height="14" rx="2" stroke="#ec4899" stroke-width="1.5" fill="none" /> <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke="#ec4899" stroke-width="1.5" /> <circle cx="8" cy="11" r="1" fill="#ec4899" /> <circle cx="16" cy="11" r="1" fill="#ec4899" /> <circle cx="12" cy="15" r="1" fill="#ec4899" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Multi-Platform Publishing</h4>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 8px; font-size: 12px; color: #fce7f3; font-weight: 600; margin-bottom: 12px;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="#fce7f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" /> <circle cx="13" cy="10" r="1.5" fill="#ec4899" />
         </svg><span>Instagram, Facebook, X &amp; TikTok</span>
        </div>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0; line-height: 1.7;">Content automatically optimized for each platform's format, audience, and best practices.</p>
       </div>
       <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><circle cx="12" cy="12" r="10" stroke="#ec4899" stroke-width="1.5" fill="none" /> <path d="M12 6v6l4 2" stroke="#ec4899" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Scheduled Publishing</h4>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0 0 12px 0; line-height: 1.7;">Plan your entire campaign timeline. Auto-schedule countdown posts, last-chance reminders, and day-of excitement.</p>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 8px; font-size: 12px; color: #fce7f3; font-weight: 600;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="#fce7f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" /> <circle cx="13" cy="10" r="1.5" fill="#ec4899" />
         </svg><span>Set it and forget it</span>
        </div>
       </div>
      </div><!-- Stats Tile at Bottom -->
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); padding: 36px 40px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);">
       <h3 style="font-size: 24px; font-weight: 800; margin: 0 0 28px 0; color: #ffffff; text-align: center;">Social Media That Actually Sells Tickets</h3>
       <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 28px;">
        <div style="text-align: center;">
         <div style="font-size: 42px; font-weight: 900; margin-bottom: 6px; color: #ffffff;">
          10x
         </div>
         <div style="font-size: 14px; color: #fce7f3; font-weight: 600;">
          Faster content creation
         </div>
        </div>
        <div style="text-align: center;">
         <div style="font-size: 42px; font-weight: 900; margin-bottom: 6px; color: #ffffff;">
          3.2x
         </div>
         <div style="font-size: 14px; color: #fce7f3; font-weight: 600;">
          More engagement
         </div>
        </div>
        <div style="text-align: center;">
         <div style="font-size: 42px; font-weight: 900; margin-bottom: 6px; color: #ffffff;">
          24/7
         </div>
         <div style="font-size: 14px; color: #fce7f3; font-weight: 600;">
          Performance tracking
         </div>
        </div>
        <div style="text-align: center;">
         <div style="font-size: 42px; font-weight: 900; margin-bottom: 6px; color: #ffffff;">
          35%
         </div>
         <div style="font-size: 14px; color: #fce7f3; font-weight: 600;">
          Ticket sales increase
         </div>
        </div>
       </div>
      </div>
     </div>
    </div><!-- Imports & Exports Page -->
    <div id="imports-page" style="display: none;">
     <div style="max-width: 1100px; margin: 0 auto;"><!-- Hero Section -->
      <div style="background: linear-gradient(135deg, #334155 0%, #1e293b 100%); padding: 48px 56px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); margin-bottom: 40px; position: relative; overflow: hidden;">
       <div style="position: absolute; top: -50px; right: -50px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%); border-radius: 50%;"></div>
       <div style="position: absolute; bottom: -80px; left: -80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%); border-radius: 50%;"></div>
       <div style="position: relative; z-index: 1;">
        <h2 style="font-size: 42px; font-weight: 900; margin: 0 0 16px 0; color: #ffffff; line-height: 1.2;">Import &amp; Export Customer Data</h2>
        <p style="font-size: 18px; color: #cbd5e1; margin: 0; line-height: 1.7; max-width: 750px;">Customer data automatically updates when you sell tickets and products via TixAll. Upload external customer lists with full GDPR compliance tracking, or export segmented audiences for campaigns.</p>
       </div>
      </div><!-- Import Section -->
      <div style="background: rgba(255, 255, 255, 0.95); padding: 32px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); margin-bottom: 24px; backdrop-filter: blur(10px);">
       <div style="margin-bottom: 24px;">
        <h3 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0; color: #2d3748;">Import Contacts</h3>
        <p style="font-size: 14px; color: #718096; margin: 0;">Upload customer data from external sources. All imports are GDPR compliant.</p>
       </div><!-- File Upload -->
       <div style="margin-bottom: 24px;"><label for="marketing_import_file" style="display: block; font-weight: 600; margin-bottom: 8px; color: #2d3748;">Upload CSV File</label> <input type="file" id="marketing_import_file" accept=".csv" style="display: block; width: 100%; padding: 10px; border: 2px dashed #cbd5e0; border-radius: 8px; cursor: pointer;">
       </div><!-- CSV Text Area -->
       <div style="margin-bottom: 24px;"><label for="marketing_import_csv" style="display: block; font-weight: 600; margin-bottom: 8px; color: #2d3748;">Or Paste CSV Data</label> <textarea id="marketing_import_csv" rows="6" placeholder="email,name,phone
john@example.com,John Doe,+44123456789" style="display: block; width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px; resize: vertical;"></textarea>
       </div><!-- Field Mapping -->
       <div style="margin-bottom: 24px;">
        <div style="font-weight: 600; margin-bottom: 12px; color: #2d3748;">
         Map CSV Columns
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
         <div><label for="mapping_email" style="display: block; font-size: 13px; color: #718096; margin-bottom: 4px;">Email Column</label> <input type="text" id="mapping_email" value="email" placeholder="email" style="width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
         </div>
         <div><label for="mapping_name" style="display: block; font-size: 13px; color: #718096; margin-bottom: 4px;">Name Column</label> <input type="text" id="mapping_name" value="name" placeholder="name" style="width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
         </div>
         <div><label for="mapping_phone" style="display: block; font-size: 13px; color: #718096; margin-bottom: 4px;">Phone Column</label> <input type="text" id="mapping_phone" value="phone" placeholder="phone" style="width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
         </div>
        </div>
       </div><!-- Import Button --> <button id="marketing_import_btn" style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; font-size: 15px; font-weight: 600; padding: 12px 32px; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; font-family: 'Outfit', sans-serif;"> Start Import </button>
      </div><!-- Export Section -->
      <div style="background: rgba(255, 255, 255, 0.95); padding: 32px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); margin-bottom: 24px; backdrop-filter: blur(10px);">
       <div style="margin-bottom: 24px;">
        <h3 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0; color: #2d3748;">Export Contacts</h3>
        <p style="font-size: 14px; color: #718096; margin: 0;">Download customer segments for external campaigns.</p>
       </div>
       <div style="display: flex; gap: 12px; flex-wrap: wrap;"><button id="marketing_export_contacts" style="background: #f7fafc; border: 1px solid #e2e8f0; color: #2d3748; font-size: 14px; font-weight: 600; padding: 10px 24px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; font-family: 'Outfit', sans-serif;"> Export All Contacts </button> <button id="marketing_export_customers" style="background: #f7fafc; border: 1px solid #e2e8f0; color: #2d3748; font-size: 14px; font-weight: 600; padding: 10px 24px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; font-family: 'Outfit', sans-serif;"> Export Customers Only </button> <button id="marketing_export_subscribers" style="background: #f7fafc; border: 1px solid #e2e8f0; color: #2d3748; font-size: 14px; font-weight: 600; padding: 10px 24px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; font-family: 'Outfit', sans-serif;"> Export Email Subscribers </button>
       </div>
      </div><!-- Import Jobs Table -->
      <div style="background: rgba(255, 255, 255, 0.95); padding: 32px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(10px);">
       <div style="margin-bottom: 24px;">
        <h3 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0; color: #2d3748;">Import History</h3>
        <p style="font-size: 14px; color: #718096; margin: 0;">Track the status of your recent imports.</p>
       </div>
       <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
        <table id="marketing_import_jobs" style="width: 100%; border-collapse: collapse; font-size: 14px;">
         <thead>
          <tr style="background: #f7fafc; border-bottom: 2px solid #e2e8f0;">
           <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Job ID</th>
           <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Started</th>
           <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Status</th>
           <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Total Rows</th>
           <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Imported</th>
           <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Errors</th>
           <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #2d3748;">Actions</th>
          </tr>
         </thead>
         <tbody><!-- Import history will be populated by your backend -->
         </tbody>
        </table>
       </div>
      </div>
     </div>
    </div><!-- Add Subscriber Page -->
    <div id="add-subscriber-page" style="display: none;">
     <div style="max-width: 800px; margin: 0 auto;"><!-- Form Container -->
      <div style="background: rgba(255, 255, 255, 0.95); padding: 40px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(10px); margin-bottom: 24px;">
       <div style="margin-bottom: 32px;">
        <h3 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: #2d3748;">Add New Customer / Subscriber</h3>
        <p style="font-size: 14px; color: #718096; margin: 0;">Manually add a customer or subscriber to your database with full profile details.</p>
       </div>
       <form id="addSubscriberForm"><!-- Personal Information Section -->
        <div style="margin-bottom: 32px;">
         <h4 style="font-size: 18px; font-weight: 700; margin: 0 0 16px 0; color: #2d3748; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">Personal Information</h4>
         <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
          <div><label for="firstName" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">First Name *</label> <input type="text" id="firstName" name="firstName" required style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
          </div>
          <div><label for="lastName" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Last Name *</label> <input type="text" id="lastName" name="lastName" required style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
          </div>
         </div>
         <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
          <div><label for="email" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Email Address *</label> <input type="email" id="email" name="email" required style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
          </div>
          <div><label for="dateOfBirth" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Date of Birth</label> <input type="date" id="dateOfBirth" name="dateOfBirth" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
          </div>
         </div>
        </div><!-- Address Section -->
        <div style="margin-bottom: 32px;">
         <h4 style="font-size: 18px; font-weight: 700; margin: 0 0 16px 0; color: #2d3748; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">Address</h4>
         <div style="margin-bottom: 16px;"><label for="address" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Street Address</label> <input type="text" id="address" name="address" placeholder="123 Main Street" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
         </div>
         <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
          <div><label for="city" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">City</label> <input type="text" id="city" name="city" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
          </div>
          <div><label for="county" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">County</label> <select id="county" name="county" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif; background: white;"> <option value="">Select County</option> <option value="Greater London">Greater London</option> <option value="Greater Manchester">Greater Manchester</option> <option value="West Midlands">West Midlands</option> <option value="West Yorkshire">West Yorkshire</option> <option value="Merseyside">Merseyside</option> <option value="South Yorkshire">South Yorkshire</option> <option value="Tyne and Wear">Tyne and Wear</option> <option value="Lancashire">Lancashire</option> <option value="Kent">Kent</option> <option value="Essex">Essex</option> <option value="Hampshire">Hampshire</option> <option value="Surrey">Surrey</option> <option value="Hertfordshire">Hertfordshire</option> <option value="Berkshire">Berkshire</option> <option value="Buckinghamshire">Buckinghamshire</option> <option value="Oxfordshire">Oxfordshire</option> <option value="Cambridgeshire">Cambridgeshire</option> <option value="Suffolk">Suffolk</option> <option value="Norfolk">Norfolk</option> <option value="Leicestershire">Leicestershire</option> <option value="Nottinghamshire">Nottinghamshire</option> <option value="Derbyshire">Derbyshire</option> <option value="Staffordshire">Staffordshire</option> <option value="Warwickshire">Warwickshire</option> <option value="Worcestershire">Worcestershire</option> <option value="Gloucestershire">Gloucestershire</option> <option value="Somerset">Somerset</option> <option value="Devon">Devon</option> <option value="Cornwall">Cornwall</option> <option value="Dorset">Dorset</option> <option value="Wiltshire">Wiltshire</option> </select>
          </div>
         </div>
         <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 16px;">
          <div><label for="postcode" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Postcode</label> <input type="text" id="postcode" name="postcode" placeholder="SW1A 1AA" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif; text-transform: uppercase;">
          </div>
         </div>
        </div>
       </form>
      </div><!-- Show & Venue Associations Section (Separate Card) -->
      <div style="background: rgba(255, 255, 255, 0.95); padding: 40px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); backdrop-filter: blur(10px);">
       <form id="showVenueForm">
        <div style="margin-bottom: 32px;">
         <h4 style="font-size: 18px; font-weight: 700; margin: 0 0 16px 0; color: #2d3748; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">Show &amp; Venue Associations</h4>
         <div style="margin-bottom: 16px;"><label for="associatedShow" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Associated Show</label> <select id="associatedShow" name="associatedShow" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif; background: white;"> <option value="">No show association</option> <option value="hamilton">Hamilton - West End</option> <option value="lion-king">The Lion King</option> <option value="wicked">Wicked</option> <option value="les-mis">Les Misérables</option> <option value="phantom">The Phantom of the Opera</option> <option value="matilda">Matilda</option> <option value="dear-evan">Dear Evan Hansen</option> <option value="six">Six the Musical</option> <option value="book-mormon">The Book of Mormon</option> <option value="frozen">Frozen</option> <option value="aladdin">Aladdin</option> <option value="chicago">Chicago</option> </select>
          <p style="font-size: 12px; color: #718096; margin: 4px 0 0 0;">Link this subscriber to a specific show they purchased tickets for</p>
         </div>
         <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
          <div><label for="ticketPrice" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Ticket Price</label> <input type="number" id="ticketPrice" name="ticketPrice" placeholder="0.00" step="0.01" min="0" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
          </div>
          <div><label for="numberOfTickets" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Number of Tickets</label> <input type="number" id="numberOfTickets" name="numberOfTickets" placeholder="0" min="0" step="1" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
          </div>
         </div>
         <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
          <div><label for="associatedVenue" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Venue</label> <select id="associatedVenue" name="associatedVenue" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif; background: white;"> <option value="">No venue</option> <option value="apollo-theatre">Apollo Theatre</option> <option value="lyceum-theatre">Lyceum Theatre</option> <option value="apollo-victoria">Apollo Victoria Theatre</option> <option value="queens-theatre">Queen's Theatre</option> <option value="palace-theatre">Palace Theatre</option> <option value="prince-edward">Prince Edward Theatre</option> <option value="theatre-royal">Theatre Royal Drury Lane</option> <option value="london-palladium">London Palladium</option> <option value="dominion-theatre">Dominion Theatre</option> <option value="sondheim-theatre">Sondheim Theatre</option> </select>
          </div>
          <div><label for="venueCity" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Venue City / Town</label> <select id="venueCity" name="venueCity" style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif; background: white;"> <option value="">Select City / Town</option> <option value="London">London</option> <option value="Manchester">Manchester</option> <option value="Birmingham">Birmingham</option> <option value="Liverpool">Liverpool</option> <option value="Leeds">Leeds</option> <option value="Glasgow">Glasgow</option> <option value="Edinburgh">Edinburgh</option> <option value="Bristol">Bristol</option> <option value="Newcastle">Newcastle</option> <option value="Sheffield">Sheffield</option> <option value="Cardiff">Cardiff</option> <option value="Belfast">Belfast</option> <option value="Nottingham">Nottingham</option> <option value="Southampton">Southampton</option> <option value="Brighton">Brighton</option> </select>
          </div>
         </div>
         <div style="margin-bottom: 16px;"><label for="showTypesInput" style="display: block; font-weight: 600; margin-bottom: 6px; color: #2d3748; font-size: 14px;">Types of Shows</label>
          <div style="position: relative;"><input type="text" id="showTypesInput" placeholder="Type and press Enter to add show types..." style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'Outfit', sans-serif;">
           <div id="selectedShowTypes" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; min-height: 20px;"><!-- Selected show types will appear here as tags -->
           </div>
          </div>
          <p style="font-size: 12px; color: #718096; margin: 4px 0 0 0;">Type a show type (e.g., "Stand-up Comedy", "Music") and press Enter to add it</p>
         </div>
        </div><!-- Form Actions -->
        <div style="display: flex; gap: 12px; padding-top: 24px; border-top: 2px solid #e2e8f0;"><button type="submit" id="submitSubscriber" style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; font-size: 15px; font-weight: 600; padding: 12px 32px; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; font-family: 'Outfit', sans-serif;"> Add Subscriber </button> <button type="button" id="clearSubscriberForm" style="background: #f7fafc; border: 1px solid #e2e8f0; color: #4a5568; font-size: 15px; font-weight: 600; padding: 12px 32px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; font-family: 'Outfit', sans-serif;"> Clear Form </button>
        </div>
       </form><!-- Success Message -->
       <div id="subscriberSuccessMessage" style="display: none; margin-top: 24px; padding: 16px; background: #d1fae5; border: 2px solid #10b981; border-radius: 8px; color: #065f46;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">
         ✓ Subscriber Added Successfully!
        </div>
        <div style="font-size: 14px;">
         The subscriber has been added to your customer database.
        </div>
       </div>
      </div>
     </div>
    </div><!-- Email Campaigns Page -->
    <div id="email-campaigns-page" style="display: none;">
     <div style="max-width: 1100px; margin: 0 auto;"><!-- Hero Section with Split Layout -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 48px 56px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); margin-bottom: 40px; position: relative; overflow: hidden;"><!-- Decorative background elements -->
       <div style="position: absolute; top: -50px; right: -50px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%); border-radius: 50%;"></div>
       <div style="position: absolute; bottom: -80px; left: -80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%); border-radius: 50%;"></div>
       <div style="position: relative; z-index: 1; max-width: 900px; margin: 0 auto;"><!-- Title and Badge Row -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; margin-bottom: 24px; flex-wrap: wrap;">
         <h2 style="font-size: 42px; font-weight: 900; margin: 0; color: #ffffff; line-height: 1.2; text-align: left; flex: 1; min-width: 280px;">Build Emails That Convert<br>
          While You Sleep</h2><span style="display: inline-flex; align-items: center; gap: 9px; background: rgba(168, 85, 247, 0.25); border: 2px solid rgba(168, 85, 247, 0.5); padding: 9px 24px; border-radius: 50px; backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2); white-space: nowrap;">
          <svg width="24" height="24" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="#ffffff" stroke-width="2" fill="none" /> <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#ffffff" stroke-width="2" stroke-linecap="round" /> <path d="M12 8v8m-4-4h8" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
          </svg><span style="background: linear-gradient(135deg, #ffffff 0%, #e9d5ff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 900; font-size: 15px;">Smart Automation</span> </span>
        </div><!-- Description -->
        <p style="font-size: 18px; color: #cbd5e1; margin: 0 0 32px 0; line-height: 1.7; max-width: 750px;">Design behavior-triggered campaigns that automatically nurture leads, recover abandoned carts, and delight customers at every touchpoint.</p><!-- CTA Button -->
        <div><button id="launchEmailBuilder" class="cta-button" style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: white; font-size: 17px; font-weight: 700; padding: 16px 36px; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.25); transition: all 0.3s ease;"> Launch Campaign Builder → </button>
        </div>
       </div>
      </div><!-- Features Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 50px;">
       <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Trigger-Based Automation</h4>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0 0 12px 0; line-height: 1.7;">Launch campaigns based on customer actions — purchases, browsing, cart abandons, milestones.</p>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; font-size: 12px; color: #e9d5ff; font-weight: 600;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="#e9d5ff" stroke-width="2" fill="none" /> <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round" /> <path d="M12 8v8m-4-4h8" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
         </svg><span>AI learns optimal send times</span>
        </div>
       </div>
       <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease; grid-row: span 2;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#a855f7" stroke-width="1.5" fill="none" /> <rect x="14" y="3" width="7" height="7" rx="1" stroke="#a855f7" stroke-width="1.5" fill="none" /> <rect x="3" y="14" width="7" height="7" rx="1" stroke="#a855f7" stroke-width="1.5" fill="none" /> <rect x="14" y="14" width="7" height="7" rx="1" stroke="#a855f7" stroke-width="1.5" fill="none" /> <circle cx="6.5" cy="6.5" r="1.5" fill="#a855f7" /> <circle cx="17.5" cy="6.5" r="1.5" fill="#a855f7" /> <circle cx="6.5" cy="17.5" r="1.5" fill="#a855f7" /> <circle cx="17.5" cy="17.5" r="1.5" fill="#a855f7" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Real-Time Analytics &amp; A/B Testing</h4>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; font-size: 12px; color: #e9d5ff; font-weight: 600; margin-bottom: 12px;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="#e9d5ff" stroke-width="2" fill="none" /> <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round" /> <path d="M12 8v8m-4-4h8" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
         </svg><span>Live performance tracking</span>
        </div>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0 0 24px 0; line-height: 1.7;">Track opens, clicks, conversions, and revenue attribution in real-time dashboards.</p>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0; line-height: 1.7;">Optimize every campaign with automatic split testing on subject lines, content, and timing. Get instant insights into what resonates with your audience and automatically route traffic to winning variants.</p>
       </div>
       <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /> <circle cx="12" cy="7" r="4" stroke="#a855f7" stroke-width="1.5" fill="none" /> <path d="M12 11c2.5 0 4.5 1 4.5 3" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Hyper-Personalization</h4>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0 0 12px 0; line-height: 1.7;">Dynamic content that adapts to each customer's preferences, history, and behavior patterns.</p>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; font-size: 12px; color: #e9d5ff; font-weight: 600;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="#e9d5ff" stroke-width="2" fill="none" /> <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round" /> <path d="M12 8v8m-4-4h8" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
         </svg><span>1-to-1 personalization at scale</span>
        </div>
       </div>
       <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><circle cx="12" cy="12" r="10" stroke="#a855f7" stroke-width="1.5" fill="none" /> <path d="M12 6v6l4 2" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Smart Frequency Control</h4>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; font-size: 12px; color: #e9d5ff; font-weight: 600; margin-bottom: 12px;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="#e9d5ff" stroke-width="2" fill="none" /> <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round" /> <path d="M12 8v8m-4-4h8" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
         </svg><span>AI prevents over-sending</span>
        </div>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0; line-height: 1.7;">Prevent email fatigue with intelligent sending limits and customer preference management.</p>
       </div>
       <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;" class="feature-card">
        <svg width="48" height="48" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#a855f7" stroke-width="1.5" fill="none" /> <path d="M3 9h18M9 3v18" stroke="#a855f7" stroke-width="1.5" /> <circle cx="6" cy="6" r="1" fill="#a855f7" />
        </svg>
        <h4 style="font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">Drag &amp; Drop Editor</h4>
        <p style="font-size: 15px; color: #cbd5e1; margin: 0 0 12px 0; line-height: 1.7;">Design stunning emails with zero coding. Professional templates that look great everywhere.</p>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; font-size: 12px; color: #e9d5ff; font-weight: 600;">
         <svg width="16" height="16" viewbox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="#e9d5ff" stroke-width="2" fill="none" /> <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round" /> <path d="M12 8v8m-4-4h8" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" />
         </svg><span>Mobile-responsive by default</span>
        </div>
       </div>
      </div><!-- Stats Tile at Bottom -->
      <div style="background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%); padding: 36px 40px; border-radius: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);">
       <h3 style="font-size: 24px; font-weight: 800; margin: 0 0 28px 0; color: #ffffff; text-align: center;">Proven Results That Speak for Themselves</h3>
       <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 28px;">
        <div style="text-align: center;">
         <div style="font-size: 42px; font-weight: 900; margin-bottom: 6px; color: #ffffff;">
          4.5x
         </div>
         <div style="font-size: 14px; color: #e9d5ff; font-weight: 600;">
          Higher engagement
         </div>
        </div>
        <div style="text-align: center;">
         <div style="font-size: 42px; font-weight: 900; margin-bottom: 6px; color: #ffffff;">
          80%
         </div>
         <div style="font-size: 14px; color: #e9d5ff; font-weight: 600;">
          Time saved
         </div>
        </div>
        <div style="text-align: center;">
         <div style="font-size: 42px; font-weight: 900; margin-bottom: 6px; color: #ffffff;">
          24/7
         </div>
         <div style="font-size: 14px; color: #e9d5ff; font-weight: 600;">
          Automated reach
         </div>
        </div>
        <div style="text-align: center;">
         <div style="font-size: 42px; font-weight: 900; margin-bottom: 6px; color: #ffffff;">
          15%
         </div>
         <div style="font-size: 14px; color: #e9d5ff; font-weight: 600;">
          Revenue boost
         </div>
        </div>
       </div>
      </div>
     </div>
    </div>
   </div>
  </div>
  <script>
    const defaultConfig = {
      main_title: "Intelligent Marketing and Powerful Automations",
      subtitle: "Manage your customer relationships and create powerful marketing campaigns that convert",
      cta_heading: "Start Growing Your Audience",
      cta_description: "Transform browsers into buyers and customers into champions. Our all-in-one marketing platform gives you everything you need to connect, engage, and convert.",
      button_text: "Get Started"
    };

    async function onConfigChange(config) {
      document.getElementById('main-title').textContent = config.main_title || defaultConfig.main_title;
      document.getElementById('subtitle').textContent = config.subtitle || defaultConfig.subtitle;
      document.getElementById('cta-heading').textContent = config.cta_heading || defaultConfig.cta_heading;
      document.getElementById('cta-description').textContent = config.cta_description || defaultConfig.cta_description;
      document.getElementById('cta-button').textContent = config.button_text || defaultConfig.button_text;
    }

    function mapToCapabilities(config) {
      return {
        recolorables: [],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
      };
    }

    function mapToEditPanelValues(config) {
      return new Map([
        ["main_title", config.main_title || defaultConfig.main_title],
        ["subtitle", config.subtitle || defaultConfig.subtitle],
        ["cta_heading", config.cta_heading || defaultConfig.cta_heading],
        ["cta_description", config.cta_description || defaultConfig.cta_description],
        ["button_text", config.button_text || defaultConfig.button_text]
      ]);
    }

    if (window.elementSdk) {
      window.elementSdk.init({
        defaultConfig,
        onConfigChange,
        mapToCapabilities,
        mapToEditPanelValues
      });
    }

    document.getElementById('cta-button').addEventListener('click', () => {
      const button = document.getElementById('cta-button');
      const originalText = button.textContent;
      button.textContent = '✓ Let\'s Go!';
      button.style.background = '#ec4899';
      button.style.color = 'white';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '#a855f7';
        button.style.color = 'white';
      }, 1500);
    });

    // Email Campaign Builder launch button
    document.addEventListener('click', (e) => {
      if (e.target.closest('#launchEmailBuilder')) {
        const button = e.target.closest('#launchEmailBuilder');
        const originalHTML = button.innerHTML;
        
        button.innerHTML = '<span>🚀 Launching...</span>';
        button.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
          button.innerHTML = '<span>✓ Builder Opened!</span>';
          button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        }, 800);
        
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.style.background = 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)';
          button.style.transform = 'scale(1)';
        }, 2500);
      }
      
      // Social Media Builder launch button
      if (e.target.closest('#launchSocialBuilder')) {
        const button = e.target.closest('#launchSocialBuilder');
        const originalHTML = button.innerHTML;
        
        button.innerHTML = '<span>🎨 Launching...</span>';
        button.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
          button.innerHTML = '<span>✓ Builder Ready!</span>';
          button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        }, 800);
        
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.style.background = 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)';
          button.style.transform = 'scale(1)';
        }, 2500);
      }
    });

    // Navigation tabs functionality
    function showPage(pageName) {
      // Hide all pages
      document.getElementById('overview-page').style.display = 'none';
      document.getElementById('customers-page').style.display = 'none';
      document.getElementById('marketing-page').style.display = 'none';
      document.getElementById('imports-page').style.display = 'none';
      document.getElementById('add-subscriber-page').style.display = 'none';
      document.getElementById('email-campaigns-page').style.display = 'none';
      
      // Show selected page
      const pageMap = {
        'customers': 'customers-page',
        'marketing': 'marketing-page',
        'imports': 'imports-page',
        'add-subscriber': 'add-subscriber-page',
        'email-campaigns': 'email-campaigns-page'
      };
      
      if (pageMap[pageName]) {
        document.getElementById(pageMap[pageName]).style.display = 'block';
        
        // If imports page, trigger your existing importsExports() function if it exists
        if (pageName === 'imports' && typeof window.importsExports === 'function') {
          window.importsExports();
        }
      } else {
        document.getElementById('overview-page').style.display = 'block';
      }
      
      // Change header text with fade effect
      const headerTexts = {
        'customers': 'Every customer has a story worth knowing',
        'marketing': 'Social media magic is about to happen',
        'imports': 'Data migration without the migraine',
        'add-subscriber': 'Add customers one at a time',
        'email-campaigns': 'Emails that get opened, not ignored',
        'overview': 'Intelligent Marketing and Powerful Automations'
      };
      
      const subtitleTexts = {
        'customers': 'Access comprehensive customer profiles, purchase history, and engagement metrics in one centralized dashboard',
        'marketing': 'Create, schedule, and optimize social media campaigns across all your platforms from one central hub',
        'imports': 'Customer data automatically updates when you sell tickets and products via TixAll. We recommend using our services fully to get the best understanding of your customers and to get closer to them. If however you have external customer data and you would like to upload it here, then please use the upload buttons below. Alternatively, you can export customer data. Please ensure that you have the right permissions from customers before you proceed with this.',
        'add-subscriber': 'Manually add individual customers or subscribers to your database with comprehensive profile information, ticket details, show associations, and venue preferences.',
        'email-campaigns': 'Instead of creating an email campaign that goes out to all your customers, create automations that mean every customer gets bespoke emails that are tailored to them.',
        'overview': 'Manage your customer relationships and create powerful marketing campaigns that convert'
      };
      
      const header = document.getElementById('main-title');
      const subtitle = document.getElementById('subtitle');
      const newText = headerTexts[pageName] || headerTexts.overview;
      const newSubtitle = subtitleTexts[pageName] || subtitleTexts.overview;
      
      // Fade out
      header.style.opacity = '0';
      subtitle.style.opacity = '0';
      
      // Change text and fade in
      setTimeout(() => {
        header.textContent = newText;
        subtitle.textContent = newSubtitle;
        header.style.opacity = '1';
        subtitle.style.opacity = '1';
      }, 400);
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        
        // Remove active class from all tabs
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        const messages = {
          'customers': '✓ Loading Customers...',
          'marketing': '✓ Loading Social Media Campaigns...',
          'imports': '✓ Loading Imports & Exports...',
          'add-subscriber': '✓ Loading Form...',
          'email-campaigns': '✓ Loading Email Campaigns...'
        };
        
        // Temporary visual feedback
        const originalText = tab.textContent;
        tab.textContent = messages[page];
        
        setTimeout(() => {
          tab.textContent = originalText;
          showPage(page);
        }, 800);
      });
    });
    
    // Drawer close functionality
    const drawerClose = document.getElementById('drawerClose');
    const drawer = document.getElementById('customerDrawer');
    const overlay = document.getElementById('customerDrawerOverlay');
    
    if (drawerClose) {
      drawerClose.addEventListener('click', () => {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
      });
    }
    
    if (overlay) {
      overlay.addEventListener('click', () => {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
      });
    }
    
    // Kebab menu functionality
    document.addEventListener('click', (e) => {
      // Toggle kebab menus
      if (e.target.matches('[data-kebab]')) {
        e.stopPropagation();
        const customerId = e.target.dataset.kebab;
        const menu = document.querySelector(`[data-menu="${customerId}"]`);
        
        // Close all other menus
        document.querySelectorAll('.kebab .menu').forEach(m => {
          if (m !== menu) m.classList.remove('open');
        });
        
        if (menu) menu.classList.toggle('open');
      } else {
        // Close all menus if clicking elsewhere
        document.querySelectorAll('.kebab .menu').forEach(m => m.classList.remove('open'));
      }
    });
    
    // Customer data - to be populated by your backend
    const sampleCustomers = [];
    
    // Sorting state
    let currentSort = { field: null, direction: 'desc' };
    let dateFilter = { type: null, from: null, to: null };
    let filteredCustomers = [...sampleCustomers];
    
    // Apply date filtering
    function applyDateFilter() {
      const emptyState = document.getElementById('customerEmpty');
      
      if (!dateFilter.type && !dateFilter.from) {
        filteredCustomers = [...sampleCustomers];
        if (emptyState) emptyState.style.display = 'none';
        renderSampleCustomers();
        return;
      }
      
      const now = new Date();
      let fromDate = null;
      let toDate = new Date();
      
      if (dateFilter.type) {
        // Calculate from date based on days ago
        toDate = new Date();
        toDate.setHours(23, 59, 59, 999);
        
        fromDate = new Date();
        fromDate.setDate(toDate.getDate() - parseInt(dateFilter.type));
        fromDate.setHours(0, 0, 0, 0);
      } else if (dateFilter.from && dateFilter.to) {
        fromDate = new Date(dateFilter.from);
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(dateFilter.to);
        toDate.setHours(23, 59, 59, 999);
      }
      
      filteredCustomers = sampleCustomers.filter(customer => {
        const purchaseDate = new Date(customer.lastPurchase + 'T12:00:00');
        return purchaseDate >= fromDate && purchaseDate <= toDate;
      });
      
      // Show empty state if no results
      if (filteredCustomers.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
      } else {
        if (emptyState) emptyState.style.display = 'none';
      }
      
      renderSampleCustomers();
    }
    
    // Sort customers
    function sortCustomers(field) {
      // Toggle direction if same field
      if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
      } else {
        currentSort.field = field;
        currentSort.direction = 'desc';
      }
      
      filteredCustomers.sort((a, b) => {
        let aVal = a[field];
        let bVal = b[field];
        
        // Handle date sorting
        if (field === 'lastPurchase') {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }
        
        if (currentSort.direction === 'desc') {
          return bVal > aVal ? 1 : -1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });
      
      renderSampleCustomers();
      updateSortIcons();
    }
    
    // Update sort icon appearance
    function updateSortIcons() {
      document.querySelectorAll('[data-sort]').forEach(btn => {
        const field = btn.dataset.sort;
        if (field === currentSort.field) {
          btn.style.color = '#a855f7';
          // Rotate icon based on direction
          const svg = btn.querySelector('svg');
          if (currentSort.direction === 'asc') {
            svg.style.transform = 'rotate(180deg)';
          } else {
            svg.style.transform = 'rotate(0deg)';
          }
        } else {
          btn.style.color = '#718096';
          const svg = btn.querySelector('svg');
          svg.style.transform = 'rotate(0deg)';
        }
      });
    }
    
    // Render sample customers
    function renderSampleCustomers() {
      const tbody = document.getElementById('customerTableBody');
      if (!tbody) return;
      
      const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
      
      tbody.innerHTML = filteredCustomers.map(customer => {
        const loyaltyClass = (customer.loyalty || '').toLowerCase();
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px;">
              <div style="font-weight: 700;">${customer.name}</div>
              <div style="font-size: 12px; color: #718096;">
                ${customer.loyalty ? `<span class="loyalty ${loyaltyClass}">${customer.loyalty}</span>` : ''}
              </div>
            </td>
            <td style="padding: 12px 16px;">${customer.id}</td>
            <td style="padding: 12px 16px;">
              ${customer.email || '-'}<br/>
              <span style="font-size: 12px; color: #718096;">${customer.phone || ''}</span>
            </td>
            <td style="padding: 12px 16px;">${customer.totalOrders}</td>
            <td style="padding: 12px 16px;">${customer.totalTickets}</td>
            <td style="padding: 12px 16px;">${customer.shows} show${customer.shows === 1 ? '' : 's'}</td>
            <td style="padding: 12px 16px;">${currency.format(customer.totalSpend)}</td>
            <td style="padding: 12px 16px;">${customer.lastPurchase}</td>
            <td style="padding: 12px 16px;">${customer.lastShow || '-'}</td>
            <td style="padding: 12px 16px;">
              <div class="kebab">
                <button class="btn" data-kebab="${customer.id}" style="font-size: 18px; padding: 4px 10px;">⋮</button>
                <div class="menu" data-menu="${customer.id}">
                  <a href="#" data-open-profile="${customer.id}">Open profile</a>
                  <a href="#" data-view-orders="${customer.id}">${customer.orders.length} recent orders</a>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      // Add click handlers for profile links
      document.querySelectorAll('[data-open-profile]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const customerId = link.dataset.openProfile;
          const customer = sampleCustomers.find(c => c.id === customerId);
          if (customer) openCustomerDrawer(customer);
        });
      });
    }
    
    // Open customer drawer with data
    function openCustomerDrawer(customer) {
      const drawer = document.getElementById('customerDrawer');
      const overlay = document.getElementById('customerDrawerOverlay');
      const drawerName = document.getElementById('drawerName');
      const drawerMeta = document.getElementById('drawerMeta');
      const drawerBody = document.getElementById('customerDrawerBody');
      
      if (!drawer || !drawerName || !drawerMeta || !drawerBody) return;
      
      const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
      const loyaltyClass = (customer.loyalty || '').toLowerCase();
      
      drawerName.textContent = customer.name;
      drawerMeta.innerHTML = `${customer.id} · ${customer.email || ''}${customer.phone ? ' · ' + customer.phone : ''}`;
      
      const tags = (customer.tags || []).map(t => `<span class="tag">${t}</span>`).join(' ');
      
      drawerBody.innerHTML = `
        <div class="drawer-section">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="title" style="margin: 0;">Overview</div>
            ${customer.loyalty ? `<span class="loyalty ${loyaltyClass}">${customer.loyalty}</span>` : ''}
          </div>
          <div class="mini-grid" style="margin-top: 12px;">
            <div class="mini-card">
              <div style="font-size: 13px; color: #718096;">Total spend</div>
              <div style="font-weight: 800; font-size: 18px; margin-top: 4px;">${currency.format(customer.totalSpend)}</div>
            </div>
            <div class="mini-card">
              <div style="font-size: 13px; color: #718096;">Orders</div>
              <div style="font-weight: 800; font-size: 18px; margin-top: 4px;">${customer.totalOrders}</div>
            </div>
            <div class="mini-card">
              <div style="font-size: 13px; color: #718096;">Tickets</div>
              <div style="font-weight: 800; font-size: 18px; margin-top: 4px;">${customer.totalTickets}</div>
            </div>
            <div class="mini-card">
              <div style="font-size: 13px; color: #718096;">Shows bought</div>
              <div style="font-weight: 800; font-size: 18px; margin-top: 4px;">${customer.shows}</div>
            </div>
          </div>
          <div class="mini-grid" style="margin-top: 12px;">
            <div class="mini-card">
              <div style="font-size: 13px; color: #718096;">First purchase</div>
              <div style="font-weight: 700; margin-top: 4px;">${customer.orders[customer.orders.length - 1]?.date || '-'}</div>
            </div>
            <div class="mini-card">
              <div style="font-size: 13px; color: #718096;">Last show</div>
              <div style="font-weight: 700; margin-top: 4px;">${customer.lastShow || '-'}</div>
            </div>
          </div>
        </div>
        
        <div class="drawer-section">
          <div class="title">Recent purchases</div>
          <div style="font-size: 13px; color: #718096; margin-bottom: 12px;">Orders list with quick actions.</div>
          ${customer.orders.map(order => {
            const statusClass = (order.status || '').toLowerCase();
            return `
              <div class="mini-card" style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <div style="font-weight: 700;">${order.show}</div>
                    <div style="font-size: 12px; color: #718096; margin-top: 2px;">${order.date} · ${order.qty} tickets</div>
                    <div style="font-size: 12px; color: #718096;">Order ${order.ref}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-weight: 600;">${currency.format(order.total)}</div>
                    <div style="margin-top: 4px;"><span class="status-badge ${statusClass}">${order.status.toLowerCase()}</span></div>
                  </div>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap;">
                  <button class="btn p">Reissue tickets email</button>
                  <button class="btn p">Refund</button>
                  <button class="btn">View order</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <div class="drawer-section">
          <div class="title" style="margin-bottom: 8px;">Notes & tags</div>
          ${customer.notes ? `<div class="mini-card">${customer.notes}</div>` : '<div style="color: #718096;">No notes captured yet.</div>'}
          ${tags ? `<div style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;">${tags}</div>` : ''}
        </div>
        
        <div class="drawer-section">
          <div class="title" style="margin-bottom: 8px;">Purchase history</div>
          <div class="mini-card">
            <div style="font-size: 13px; color: #718096; margin-bottom: 8px;">Shows attended / purchased over time</div>
            ${customer.orders.map(order => `
              <div style="display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
                <div>${order.show}</div>
                <div style="font-size: 12px; color: #718096;">${order.date}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      
      drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
    }
    
    // Load sample data when customers page is shown
    const customersTab = document.querySelector('[data-page="customers"]');
    if (customersTab) {
      customersTab.addEventListener('click', () => {
        setTimeout(() => {
          renderSampleCustomers();
          
          // Add sort button listeners
          document.querySelectorAll('[data-sort]').forEach(btn => {
            btn.addEventListener('click', () => {
              sortCustomers(btn.dataset.sort);
            });
          });
          
          // Date filter toggle
          const dateFilterToggle = document.getElementById('dateFilterToggle');
          const dateFilterMenu = document.getElementById('dateFilterMenu');
          
          if (dateFilterToggle && dateFilterMenu) {
            dateFilterToggle.addEventListener('click', (e) => {
              e.stopPropagation();
              dateFilterMenu.style.display = dateFilterMenu.style.display === 'none' ? 'block' : 'none';
            });
          }
          
          // Close date filter when clicking outside
          document.addEventListener('click', (e) => {
            if (dateFilterMenu && !dateFilterMenu.contains(e.target) && e.target !== dateFilterToggle) {
              dateFilterMenu.style.display = 'none';
            }
          });
          
          // Preset date filters
          document.querySelectorAll('[data-date-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
              dateFilter.type = btn.dataset.dateFilter;
              dateFilter.from = null;
              dateFilter.to = null;
              applyDateFilter();
              dateFilterMenu.style.display = 'none';
              
              // Visual feedback
              document.querySelectorAll('.date-filter-option').forEach(b => {
                b.style.background = 'white';
                b.style.borderColor = '#e2e8f0';
              });
              btn.style.background = '#f3e8ff';
              btn.style.borderColor = '#a855f7';
            });
          });
          
          // Custom date range
          const applyCustomDate = document.getElementById('applyCustomDate');
          const dateFrom = document.getElementById('dateFrom');
          const dateTo = document.getElementById('dateTo');
          
          if (applyCustomDate && dateFrom && dateTo) {
            applyCustomDate.addEventListener('click', () => {
              if (dateFrom.value && dateTo.value) {
                dateFilter.type = null;
                dateFilter.from = dateFrom.value;
                dateFilter.to = dateTo.value;
                applyDateFilter();
                dateFilterMenu.style.display = 'none';
              }
            });
          }
          
          // Clear date filter
          const clearDateFilter = document.getElementById('clearDateFilter');
          if (clearDateFilter) {
            clearDateFilter.addEventListener('click', () => {
              dateFilter = { type: null, from: null, to: null };
              filteredCustomers = [...sampleCustomers];
              renderSampleCustomers();
              dateFilterMenu.style.display = 'none';
              
              // Reset visual feedback
              document.querySelectorAll('.date-filter-option').forEach(b => {
                b.style.background = 'white';
                b.style.borderColor = '#e2e8f0';
              });
              
              if (dateFrom) dateFrom.value = '';
              if (dateTo) dateTo.value = '';
            });
          }
        }, 100);
      });
    }
    
    // YOUR EXISTING IMPORTS/EXPORTS CODE INTEGRATION POINT
    // Replace the div#imports-exports-content with your importsExports() function content
    // The container is ready at: document.getElementById('imports-exports-content')
    
    // Add Subscriber Form Functionality
    const subscriberForm = document.getElementById('addSubscriberForm');
    const showVenueForm = document.getElementById('showVenueForm');
    const clearFormBtn = document.getElementById('clearSubscriberForm');
    const successMessage = document.getElementById('subscriberSuccessMessage');
    
    // Show Types Multi-Select Functionality
    const showTypesInput = document.getElementById('showTypesInput');
    const selectedShowTypesContainer = document.getElementById('selectedShowTypes');
    let selectedShowTypes = [];
    
    if (showTypesInput && selectedShowTypesContainer) {
      showTypesInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const value = showTypesInput.value.trim();
          
          if (value && !selectedShowTypes.includes(value)) {
            selectedShowTypes.push(value);
            renderShowTypes();
            showTypesInput.value = '';
          }
        }
      });
    }
    
    function renderShowTypes() {
      selectedShowTypesContainer.innerHTML = selectedShowTypes.map((type, index) => `
        <div style="display: inline-flex; align-items: center; gap: 6px; background: #e0e7ff; color: #3730a3; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">
          <span>${type}</span>
          <button type="button" data-remove-type="${index}" style="background: none; border: none; cursor: pointer; color: #3730a3; font-size: 16px; line-height: 1; padding: 0; margin: 0;">×</button>
        </div>
      `).join('');
      
      // Add remove listeners
      document.querySelectorAll('[data-remove-type]').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.dataset.removeType);
          selectedShowTypes.splice(index, 1);
          renderShowTypes();
        });
      });
    }
    
    if (showVenueForm) {
      showVenueForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form data from both forms
        const personalFormData = new FormData(subscriberForm);
        const showVenueFormData = new FormData(showVenueForm);
        
        const subscriberData = {
          firstName: personalFormData.get('firstName'),
          lastName: personalFormData.get('lastName'),
          email: personalFormData.get('email'),
          dateOfBirth: personalFormData.get('dateOfBirth'),
          address: personalFormData.get('address'),
          city: personalFormData.get('city'),
          county: personalFormData.get('county'),
          postcode: personalFormData.get('postcode'),
          associatedShow: showVenueFormData.get('associatedShow'),
          ticketPrice: showVenueFormData.get('ticketPrice'),
          numberOfTickets: showVenueFormData.get('numberOfTickets'),
          associatedVenue: showVenueFormData.get('associatedVenue'),
          venueCity: showVenueFormData.get('venueCity'),
          showTypes: selectedShowTypes
        };
        
        // Show loading state
        const submitBtn = document.getElementById('submitSubscriber');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.style.opacity = '0.7';
        submitBtn.disabled = true;
        
        // Simulate submission (replace with your actual backend call)
        setTimeout(() => {
          console.log('Subscriber Data:', subscriberData);
          
          // Show success message
          successMessage.style.display = 'block';
          
          // Reset button
          submitBtn.textContent = originalText;
          submitBtn.style.opacity = '1';
          submitBtn.disabled = false;
          
          // Clear forms
          subscriberForm.reset();
          showVenueForm.reset();
          selectedShowTypes = [];
          renderShowTypes();
          
          // Hide success message after 5 seconds
          setTimeout(() => {
            successMessage.style.display = 'none';
          }, 5000);
          
          // Scroll to success message
          successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 1000);
      });
    }
    
    if (clearFormBtn) {
      clearFormBtn.addEventListener('click', () => {
        subscriberForm.reset();
        showVenueForm.reset();
        selectedShowTypes = [];
        renderShowTypes();
        successMessage.style.display = 'none';
      });
    }
  </script>
 <script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'9bbccd663073b78a',t:'MTc2ODA1NDY5My4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script></body>
</html>
