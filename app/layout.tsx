import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Thinking Graph — מרחב החשיבה שלך',description:'שיחות, רעיונות והקשרים ביניהם, עם דרך חזרה לכל מקור.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="he"><body>{children}</body></html>}
