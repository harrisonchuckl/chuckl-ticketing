export default function RootLayout({ children }){
  return (<html lang="en"><body style={{fontFamily:'system-ui',margin:0}}>
    <header style={{padding:'12px 16px',background:'#0076D3',color:'#fff',fontWeight:700}}>Chuckl Tickets</header>
    <main style={{padding:'16px'}}>{children}</main></body></html>);
}