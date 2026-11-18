import { forwardRef } from 'react';
import type { CSSProperties, ComponentType, HTMLAttributes, Ref } from 'react';

export type IconTone = 'default' | 'ink';
export type IconVariant = 'auto' | 'sm';
export type GlyphProps = Omit<HTMLAttributes<HTMLSpanElement>, 'color'> & { size?: number | string; color?: string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean; tone?: IconTone; variant?: IconVariant };
export const aliases: Record<string,string> = {"expense": "expense", "income": "income", "transfer": "transfer", "reports": "reports", "home": "home", "wallet": "wallet", "activity": "activity", "settings": "settings", "overview": "Wallet", "calendar": "CalendarDays", "search": "Search", "filter": "SlidersHorizontal", "chevron": "ChevronDown", "check": "Check", "close": "X", "edit": "Pencil", "delete": "Trash2", "stat-income": "income", "nav-transactions": "activity", "nav-reports-active": "reports", "report-light": "reports", "report-dark": "reports", "settings-data": "HardDrive", "settings-notifications": "Bell", "settings-warning": "Info", "nav-capture": "ScanLine", "category-food": "category-food", "category-utilities": "category-utilities", "category-transport": "category-transport", "category-home": "category-home", "category-entertainment": "category-entertainment", "category-subscription": "category-subscription", "category-health": "category-health", "category-shopping": "category-shopping", "category-education": "category-education", "category-relationship": "category-relationship", "category-transfer": "category-transfer", "category-other": "category-other", "category-saving": "category-saving", "category-together": "category-together", "category-capture": "category-capture"};
export function assetName(name: string) { return aliases[name] || name; }
// Rendered 3D artwork loses its bevel below ~22px, so those sizes use the
// simplified 64px variants (thicker body, same silhouette) shipped next to the
// full renders. `ink` keeps the render's shading but remaps it onto dark violet
// for glyphs sitting on the lavender card, replacing flat brightness(0) filters.
export const SIMPLIFIED = new Set(['Cloud','Eye','EyeOff','ChevronDown','ChevronRight','ChevronLeft','Plus','ArrowRight','ArrowUpRight','ArrowDownLeft','ArrowLeftRight','Check','X','Info','Search','Cross','LoaderCircle','RefreshCw']);
export const SMALL_ICON_MAX = 21;
export function resolveAsset(name: string, size: number | string | undefined, tone: IconTone = 'default', variant: IconVariant = 'auto') {
  const base = assetName(name);
  if (!SIMPLIFIED.has(base)) return `/icons/3d-v2/${base}.webp`;
  const px = typeof size === 'number' ? size : Number(size);
  const small = variant === 'sm' || (Number.isFinite(px) && px > 0 && px <= SMALL_ICON_MAX);
  if (!small) return tone === 'ink' ? `/icons/3d-v2/ink/${base}.webp` : `/icons/3d-v2/${base}.webp`;
  return tone === 'ink' ? `/icons/3d-v2/ink-sm/${base}.webp` : `/icons/3d-v2/sm/${base}.webp`;
}
export function MeshIcon({name, size=24, className='', style, tone='default', variant='auto', ...rest}: GlyphProps & {name:string}, ref?: Ref<HTMLSpanElement>) {
 const { strokeWidth: _stroke, absoluteStrokeWidth: _absolute, color: _color, ...attrs } = rest;
 const px = typeof size === 'number' ? size : Number(size);
 const depth = Number.isFinite(px) && px >= 20 ? 'has-depth' : '';
 return <span {...attrs} ref={ref} className={`mesh-icon ${depth} ${className}`} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, width:size, height:size, verticalAlign:'middle', ...style } as CSSProperties}><img src={resolveAsset(name, size, tone, variant)} width={size} height={size} alt="" aria-hidden="true" draggable={false} style={{display:'block',width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none'}} /></span>;
}
export const ArrowLeftRight = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ArrowLeftRight'}, ref));
export const Sparkles = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Sparkles'}, ref));
export const Heart = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Heart'}, ref));
export const Plus = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Plus'}, ref));
export const ArrowUpRight = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ArrowUpRight'}, ref));
export const ChevronRight = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ChevronRight'}, ref));
export const ShieldCheck = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ShieldCheck'}, ref));
export const ArrowRight = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ArrowRight'}, ref));
export const Users = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Users'}, ref));
export const Download = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Download'}, ref));
export const X = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'X'}, ref));
export const Check = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Check'}, ref));
export const Info = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Info'}, ref));
export const Target = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Target'}, ref));
export const TrendingUp = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'TrendingUp'}, ref));
export const Coffee = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Coffee'}, ref));
export const PiggyBank = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'PiggyBank'}, ref));
export const RefreshCw = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'RefreshCw'}, ref));
export const Trash2 = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Trash2'}, ref));
export const LoaderCircle = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'LoaderCircle'}, ref));
export const HardDrive = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'HardDrive'}, ref));
export const Sprout = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Sprout'}, ref));
export const House = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'House'}, ref));
export const Plane = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Plane'}, ref));
export const Gem = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Gem'}, ref));
export const GraduationCap = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'GraduationCap'}, ref));
export const Laptop = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Laptop'}, ref));
export const ChartNoAxesCombined = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ChartNoAxesCombined'}, ref));
export const NotebookPen = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'NotebookPen'}, ref));
export const ReceiptText = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ReceiptText'}, ref));
export const Eye = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Eye'}, ref));
export const EyeOff = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'EyeOff'}, ref));
export const Wallet = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Wallet'}, ref));
export const SlidersHorizontal = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'SlidersHorizontal'}, ref));
export const CalendarDays = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'CalendarDays'}, ref));
export const FileChartColumn = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'FileChartColumn'}, ref));
export const RotateCcw = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'RotateCcw'}, ref));
export const ChevronDown = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ChevronDown'}, ref));
export const Pencil = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Pencil'}, ref));
export const ScanLine = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ScanLine'}, ref));
export const ArrowDownLeft = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ArrowDownLeft'}, ref));
export const Cloud = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Cloud'}, ref));
export const Paperclip = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Paperclip'}, ref));
export const Search = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Search'}, ref));
export const Bell = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Bell'}, ref));
export const Soup = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Soup'}, ref));
export const Bus = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Bus'}, ref));
export const Clapperboard = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Clapperboard'}, ref));
export const CalendarCheck = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'CalendarCheck'}, ref));
export const Cross = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Cross'}, ref));
export const ShoppingBag = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ShoppingBag'}, ref));
export const LayoutGrid = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'LayoutGrid'}, ref));
export const Landmark = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Landmark'}, ref));
export const LockKeyhole = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'LockKeyhole'}, ref));
export const LogOut = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'LogOut'}, ref));
export const Upload = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'Upload'}, ref));
export const ChevronLeft = forwardRef<HTMLSpanElement, GlyphProps>((props, ref) => MeshIcon({...props, name:'ChevronLeft'}, ref));
export type GlyphIcon = ComponentType<{ size?: number | string; className?: string; color?: string; strokeWidth?: number | string; 'aria-hidden'?: boolean }>;
