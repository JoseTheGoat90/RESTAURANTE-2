/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { useData } from '../context/DataContext.tsx';
import {
  formatCOP,
  formatBogotaDateTime,
  capitalizeFirst,
  generateOperationId,
  formatStock,
} from '../utils/formatters.ts';
import { RESTAURANT_IMAGES } from '../assets/images.ts';
import {
  staggerContainerVariants,
  cardItemVariants,
  fastStaggerContainerVariants,
  tableRowVariants,
  listItemVariants,
} from '../utils/animations.ts';
import {
  UtensilsCrossed,
  Plus,
  Minus,
  Loader2,
  Clock,
  Boxes,
  ArrowRight,
  Check,
  Bike,
  PackageCheck,
  MapPin,
  Phone,
  AlertTriangle,
  Store,
  Sparkles,
  Salad,
  Flame,
  Soup,
  Beef,
  Coffee,
  Info,
} from 'lucide-react';
import { TipoPedido, EstadoComanda, TamanoPorcion } from '../types.ts';

type CategoriaPlato = 'todos' | 'asados' | 'almuerzos_sopas' | 'bebidas';

export interface ItemMenuOficial {
  plato: string;
  nombreVisible: string;
  categoria: CategoriaPlato;
  descripcion: string;
  esAsado?: boolean;
  esSopaOAlmuerzo?: boolean;
  esBebida?: boolean;
  precioMedia?: number;
  precioEntera?: number;
  precioMesa?: number;
  precioLlevar?: number;
  precioFijo?: number;
  ingredientePrincipal: string;
  cantidadPrincipal: number;
  unidadPrincipal: string;
  acompSugerido?: string;
}

export const MENU_OFICIAL_DOCUMENTO: ItemMenuOficial[] = [
  // 1. Asados (Precios según documento: Res Media $15.000 / Entera $22.000. Otros Media $14.000 / Entera $20.000)
  {
    plato: 'asado de carne de res',
    nombreVisible: 'Asado de Carne de Res',
    categoria: 'asados',
    descripcion: 'Corte selecto de carne de res asado a la parrilla en su punto exacto.',
    esAsado: true,
    precioMedia: 15000,
    precioEntera: 22000,
    ingredientePrincipal: 'carne de res',
    cantidadPrincipal: 0.5,
    unidadPrincipal: 'lb',
    acompSugerido: 'patacon',
  },
  {
    plato: 'lomo de cerdo',
    nombreVisible: 'Asado de Lomo de Cerdo',
    categoria: 'asados',
    descripcion: 'Corte magro y tierno de lomo de cerdo asado a la plancha.',
    esAsado: true,
    precioMedia: 14000,
    precioEntera: 20000,
    ingredientePrincipal: 'lomo de cerdo',
    cantidadPrincipal: 0.5,
    unidadPrincipal: 'lb',
    acompSugerido: 'patacon',
  },
  {
    plato: 'pechuga a la plancha',
    nombreVisible: 'Pechuga de Pollo a la Plancha',
    categoria: 'asados',
    descripcion: 'Filete de pechuga marinada en finas hierbas y asada a la plancha.',
    esAsado: true,
    precioMedia: 14000,
    precioEntera: 20000,
    ingredientePrincipal: 'pechuga',
    cantidadPrincipal: 0.5,
    unidadPrincipal: 'lb',
    acompSugerido: 'papa',
  },
  {
    plato: 'chuleta de cerdo',
    nombreVisible: 'Chuleta de Cerdo',
    categoria: 'asados',
    descripcion: 'Chuleta de cerdo seleccionada y dorada a fuego medio.',
    esAsado: true,
    precioMedia: 14000,
    precioEntera: 20000,
    ingredientePrincipal: 'chuleta',
    cantidadPrincipal: 1,
    unidadPrincipal: 'unidad',
    acompSugerido: 'patacon',
  },

  // 2. Almuerzos y Sopas (Precios diferenciados: Para consumir en mesa vs Para llevar)
  {
    plato: 'almuerzo corriente',
    nombreVisible: 'Almuerzo Corriente del Día',
    categoria: 'almuerzos_sopas',
    descripcion: 'Incluye la preparación del día según la oferta del restaurante, sopa, principio y seco.',
    esSopaOAlmuerzo: true,
    precioMesa: 13000,
    precioLlevar: 14000,
    ingredientePrincipal: 'carne molida',
    cantidadPrincipal: 0.35,
    unidadPrincipal: 'lb',
    acompSugerido: 'arroz',
  },
  {
    plato: 'almuerzo seco',
    nombreVisible: 'Almuerzo Seco (Sin Sopa)',
    categoria: 'almuerzos_sopas',
    descripcion: 'Almuerzo completo sin sopa, incluye seco, principio, ensalada y acompañamiento.',
    esSopaOAlmuerzo: true,
    precioMesa: 11000,
    precioLlevar: 12000,
    ingredientePrincipal: 'chicharrón',
    cantidadPrincipal: 0.35,
    unidadPrincipal: 'lb',
    acompSugerido: 'patacon',
  },
  {
    plato: 'sopa de mondongo',
    nombreVisible: 'Sopa de Mondongo Tradicional',
    categoria: 'almuerzos_sopas',
    descripcion: 'Sopa tradicional de mondongo con verduras, aliños criollos y vituallas.',
    esSopaOAlmuerzo: true,
    precioMesa: 15000,
    precioLlevar: 16000,
    ingredientePrincipal: 'carne salada',
    cantidadPrincipal: 0.4,
    unidadPrincipal: 'lb',
    acompSugerido: 'bollo',
  },
  {
    plato: 'ajiaco',
    nombreVisible: 'Ajiaco Santafereño',
    categoria: 'almuerzos_sopas',
    descripcion: 'Sopa espesa tradicional con pechuga de pollo desmechada, papa y maíz.',
    esSopaOAlmuerzo: true,
    precioMesa: 15000,
    precioLlevar: 16000,
    ingredientePrincipal: 'pollo (para sopas y guisar)',
    cantidadPrincipal: 0.4,
    unidadPrincipal: 'lb',
    acompSugerido: 'bollo',
  },
  {
    plato: 'mote de queso',
    nombreVisible: 'Mote de Queso Costeño',
    categoria: 'almuerzos_sopas',
    descripcion: 'Sopa cremosa con ñame, queso costeño fresco, hogao y toque de ajo.',
    esSopaOAlmuerzo: true,
    precioMesa: 15000,
    precioLlevar: 16000,
    ingredientePrincipal: 'queso',
    cantidadPrincipal: 0.3,
    unidadPrincipal: 'lb',
    acompSugerido: 'bollo',
  },
  {
    plato: 'sopa de costilla de res',
    nombreVisible: 'Sopa de Costilla de Res',
    categoria: 'almuerzos_sopas',
    descripcion: 'Sopa casera con costilla de res tierna, papa, yuca y vituallas tradicionales.',
    esSopaOAlmuerzo: true,
    precioMesa: 15000,
    precioLlevar: 16000,
    ingredientePrincipal: 'costillas de res',
    cantidadPrincipal: 0.5,
    unidadPrincipal: 'lb',
    acompSugerido: 'bollo',
  },
  {
    plato: 'sopa de jarrete tradicional',
    nombreVisible: 'Sopa de Jarrete Tradicional',
    categoria: 'almuerzos_sopas',
    descripcion: 'Sopa sustanciosa con jarrete grueso de res, papa y vituallas campesinas.',
    esSopaOAlmuerzo: true,
    precioMesa: 15000,
    precioLlevar: 16000,
    ingredientePrincipal: 'jarrete grueso',
    cantidadPrincipal: 0.5,
    unidadPrincipal: 'lb',
    acompSugerido: 'bollo',
  },

  // 3. Bebidas (Precios fijos exactos del documento)
  {
    plato: 'gaseosa postobon personal',
    nombreVisible: 'Gaseosa Postobón Personal',
    categoria: 'bebidas',
    descripcion: 'Bebida gaseosa personal presentación individual.',
    esBebida: true,
    precioFijo: 3500,
    ingredientePrincipal: 'gaseosa postobon',
    cantidadPrincipal: 1,
    unidadPrincipal: 'unidad',
  },
  {
    plato: 'gaseosa coca-cola personal',
    nombreVisible: 'Gaseosa Coca-Cola Personal',
    categoria: 'bebidas',
    descripcion: 'Bebida gaseosa Coca-Cola personal presentación individual.',
    esBebida: true,
    precioFijo: 3500,
    ingredientePrincipal: 'gaseosa coca-cola',
    cantidadPrincipal: 1,
    unidadPrincipal: 'unidad',
  },
  {
    plato: 'coca-cola 1.5 litros',
    nombreVisible: 'Coca-Cola 1,5 Litros',
    categoria: 'bebidas',
    descripcion: 'Bebida gaseosa Coca-Cola presentación familiar 1,5 litros.',
    esBebida: true,
    precioFijo: 7000,
    ingredientePrincipal: 'coca-cola familiar',
    cantidadPrincipal: 1,
    unidadPrincipal: 'unidad',
  },
  {
    plato: 'agua presentacion 1',
    nombreVisible: 'Agua Presentación 1',
    categoria: 'bebidas',
    descripcion: 'Agua embotellada presentación estándar económica.',
    esBebida: true,
    precioFijo: 1000,
    ingredientePrincipal: 'agua 1',
    cantidadPrincipal: 1,
    unidadPrincipal: 'unidad',
  },
  {
    plato: 'agua presentacion 2',
    nombreVisible: 'Agua Presentación 2',
    categoria: 'bebidas',
    descripcion: 'Agua embotellada presentación premium o mayor tamaño.',
    esBebida: true,
    precioFijo: 2000,
    ingredientePrincipal: 'agua 2',
    cantidadPrincipal: 1,
    unidadPrincipal: 'unidad',
  },
];

interface AcompanamientoOption {
  id: string;
  label: string;
  insumo: string;
  cantidad: number;
  unidad: string;
}

const ACOMPANAMIENTOS_PRESET: AcompanamientoOption[] = [
  { id: 'patacon', label: 'Patacón frito (2 un.)', insumo: 'patacón', cantidad: 2, unidad: 'unidad' },
  { id: 'bollo', label: 'Bollo tradicional (1 un.)', insumo: 'bollo', cantidad: 1, unidad: 'unidad' },
  { id: 'yuca', label: 'Yuca cocida (porción)', insumo: 'yuca', cantidad: 0.35, unidad: 'lb' },
  { id: 'papa', label: 'Papa cocida (porción)', insumo: 'papa', cantidad: 0.35, unidad: 'lb' },
  { id: 'ninguno', label: 'Sin acompañamiento', insumo: '', cantidad: 0, unidad: '' },
];

export const VenderTab: React.FC = () => {
  const { recetas, ventas, ingredientes, executeSale, updateOrderStatus, showNotification } = useData();

  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaPlato>('todos');
  const [selectedPlatoId, setSelectedPlatoId] = useState<string>('asado de carne de res');
  const [tamanoPorcion, setTamanoPorcion] = useState<TamanoPorcion>('entera');
  const [selectedAcomp, setSelectedAcomp] = useState<string>('patacon');
  const [conEnsalada, setConEnsalada] = useState<boolean>(true);
  const [conSalsas, setConSalsas] = useState<boolean>(true);
  const [cantidad, setCantidad] = useState<number>(1);
  const [tipoPedido, setTipoPedido] = useState<TipoPedido>('mesa');
  const [mesa, setMesa] = useState<string>('Mesa 1');
  const [direccion, setDireccion] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selected item from canonical catalog
  const currentItem = useMemo(() => {
    return MENU_OFICIAL_DOCUMENTO.find((m) => m.plato === selectedPlatoId) || MENU_OFICIAL_DOCUMENTO[0];
  }, [selectedPlatoId]);

  // Calculate unit price dynamically based on modality and portion
  const unitPrice = useMemo(() => {
    if (!currentItem) return 0;
    if (currentItem.esBebida) {
      return currentItem.precioFijo || 3500;
    }
    if (currentItem.esAsado) {
      return tamanoPorcion === 'media'
        ? (currentItem.precioMedia || 14000)
        : (currentItem.precioEntera || 20000);
    }
    if (currentItem.esSopaOAlmuerzo) {
      return (tipoPedido === 'para_llevar' || tipoPedido === 'domicilio')
        ? (currentItem.precioLlevar || 16000)
        : (currentItem.precioMesa || 15000);
    }
    return 15000;
  }, [currentItem, tamanoPorcion, tipoPedido]);

  const totalPrice = unitPrice * cantidad;

  // Filter items by category
  const itemsVisibles = useMemo(() => {
    if (filtroCategoria === 'todos') return MENU_OFICIAL_DOCUMENTO;
    return MENU_OFICIAL_DOCUMENTO.filter((m) => m.categoria === filtroCategoria);
  }, [filtroCategoria]);

  // When selected item changes, set smart accompaniment and complements
  useEffect(() => {
    if (currentItem.categoria === 'almuerzos_sopas') {
      setSelectedAcomp(currentItem.acompSugerido || 'bollo');
      setConEnsalada(false);
    } else if (currentItem.categoria === 'asados') {
      setSelectedAcomp(currentItem.acompSugerido || 'patacon');
      setConEnsalada(true);
    }
  }, [currentItem]);

  // Real-time inventory deduction calculation
  const recipeImpact = useMemo(() => {
    if (!currentItem) return [];
    const items: Array<{
      ingrediente: string;
      tipo: string;
      cantidadTotal: number;
      stockActual: number;
      stockMinimo: number;
      unidad: string;
      stockRestante: number;
      isCritical: boolean;
      isDeficit: boolean;
    }> = [];

    // 1. Meat / Core ingredient
    if (!currentItem.esBebida) {
      const neededFactor = currentItem.esAsado && tamanoPorcion === 'media' ? 0.6 : 1.0;
      const neededMain = Number((currentItem.cantidadPrincipal * neededFactor * cantidad).toFixed(2));
      const ing = ingredientes.find((i) => i.ingrediente.toLowerCase().includes(currentItem.ingredientePrincipal.toLowerCase()));
      const curStock = ing ? ing.stock : 0;
      const minStock = ing ? ing.stock_minimo : 0;
      const rem = curStock - neededMain;

      items.push({
        ingrediente: currentItem.ingredientePrincipal,
        tipo: 'Proteína Principal',
        cantidadTotal: neededMain,
        stockActual: curStock,
        stockMinimo: minStock,
        unidad: currentItem.unidadPrincipal,
        stockRestante: rem,
        isCritical: rem <= minStock,
        isDeficit: rem < 0,
      });
    }

    // 2. Accompaniment if selected (for food items)
    if (!currentItem.esBebida && selectedAcomp && selectedAcomp !== 'ninguno') {
      const preset = ACOMPANAMIENTOS_PRESET.find((a) => a.id === selectedAcomp);
      if (preset && preset.insumo) {
        const ing = ingredientes.find((i) => i.ingrediente.toLowerCase().includes(preset.insumo));
        const neededAcomp = Number((preset.cantidad * cantidad).toFixed(2));
        const curStock = ing ? ing.stock : 0;
        const minStock = ing ? ing.stock_minimo : 0;
        const rem = curStock - neededAcomp;

        items.push({
          ingrediente: preset.label,
          tipo: 'Acompañamiento',
          cantidadTotal: neededAcomp,
          stockActual: curStock,
          stockMinimo: minStock,
          unidad: preset.unidad,
          stockRestante: rem,
          isCritical: rem <= minStock,
          isDeficit: rem < 0,
        });
      }
    }

    // 3. Salad if checked
    if (!currentItem.esBebida && conEnsalada) {
      const ing = ingredientes.find((i) => i.ingrediente.toLowerCase().includes('ensalada'));
      const needed = 1 * cantidad;
      const curStock = ing ? ing.stock : 0;
      const minStock = ing ? ing.stock_minimo : 0;
      const rem = curStock - needed;

      items.push({
        ingrediente: 'Ensalada fresca',
        tipo: 'Complemento',
        cantidadTotal: needed,
        stockActual: curStock,
        stockMinimo: minStock,
        unidad: 'porción',
        stockRestante: rem,
        isCritical: rem <= minStock,
        isDeficit: rem < 0,
      });
    }

    // 4. House sauce if checked
    if (!currentItem.esBebida && conSalsas) {
      const ing = ingredientes.find((i) => i.ingrediente.toLowerCase().includes('salsas'));
      const needed = 1 * cantidad;
      const curStock = ing ? ing.stock : 0;
      const minStock = ing ? ing.stock_minimo : 0;
      const rem = curStock - needed;

      items.push({
        ingrediente: 'Salsas de la casa',
        tipo: 'Complemento',
        cantidadTotal: needed,
        stockActual: curStock,
        stockMinimo: minStock,
        unidad: 'porción',
        stockRestante: rem,
        isCritical: rem <= minStock,
        isDeficit: rem < 0,
      });
    }

    // 5. Disposables for take out or delivery
    if (tipoPedido === 'domicilio' || tipoPedido === 'para_llevar') {
      const isSopa = currentItem.categoria === 'almuerzos_sopas' && currentItem.plato.includes('sopa');
      const empaqueIng = ingredientes.find((i) => i.ingrediente.toLowerCase().includes(isSopa ? 'térmico para sopa' : 'para secos'));
      const empStock = empaqueIng ? empaqueIng.stock : 0;
      const empMin = empaqueIng ? empaqueIng.stock_minimo : 0;
      const empRem = empStock - cantidad;

      items.push({
        ingrediente: isSopa ? 'Empaque térmico para sopa' : 'Empaque para secos',
        tipo: 'Empaque desechable',
        cantidadTotal: cantidad,
        stockActual: empStock,
        stockMinimo: empMin,
        unidad: 'unidad',
        stockRestante: empRem,
        isCritical: empRem <= empMin,
        isDeficit: empRem < 0,
      });

      const cubiertosIng = ingredientes.find((i) => i.ingrediente.toLowerCase().includes('cubiertos'));
      const cubStock = cubiertosIng ? cubiertosIng.stock : 0;
      const cubMin = cubiertosIng ? cubiertosIng.stock_minimo : 0;
      const cubRem = cubStock - cantidad;

      items.push({
        ingrediente: 'Cubiertos desechables',
        tipo: 'Desechable',
        cantidadTotal: cantidad,
        stockActual: cubStock,
        stockMinimo: cubMin,
        unidad: 'unidad',
        stockRestante: cubRem,
        isCritical: cubRem <= cubMin,
        isDeficit: cubRem < 0,
      });

      if (tipoPedido === 'domicilio') {
        const bolsaIng = ingredientes.find((i) => i.ingrediente.toLowerCase().includes('bolsa'));
        const bolsaStock = bolsaIng ? bolsaIng.stock : 0;
        const bolsaMin = bolsaIng ? bolsaIng.stock_minimo : 0;

        items.push({
          ingrediente: 'Bolsa de domicilio',
          tipo: 'Empaque domicilio',
          cantidadTotal: 1,
          stockActual: bolsaStock,
          stockMinimo: bolsaMin,
          unidad: 'unidad',
          stockRestante: bolsaStock - 1,
          isCritical: bolsaStock - 1 <= bolsaMin,
          isDeficit: bolsaStock - 1 < 0,
        });
      }
    }

    return items;
  }, [currentItem, tamanoPorcion, cantidad, selectedAcomp, conEnsalada, conSalsas, tipoPedido, ingredientes]);

  const hasInventoryDeficit = useMemo(() => {
    return recipeImpact.some((item) => item.isDeficit);
  }, [recipeImpact]);

  const handleRegisterSale = async (estadoComanda: EstadoComanda = 'pagado') => {
    setFormError(null);

    if (!currentItem) {
      setFormError('Por favor selecciona un producto del menú');
      return;
    }
    if (cantidad <= 0) {
      setFormError('La cantidad debe ser mayor a 0');
      return;
    }
    if (tipoPedido === 'domicilio' && !direccion.trim()) {
      setFormError('Por favor ingresa la dirección completa para el domicilio');
      return;
    }

    setIsSubmitting(true);
    const opId = generateOperationId('PED');

    try {
      const acompLabel = !currentItem.esBebida && selectedAcomp !== 'ninguno'
        ? ACOMPANAMIENTOS_PRESET.find((a) => a.id === selectedAcomp)?.label || selectedAcomp
        : undefined;

      const result = await executeSale({
        p_id: opId,
        p_plato: currentItem.plato,
        p_cantidad: cantidad,
        p_precio_unitario: unitPrice,
        tamano_porcion: currentItem.esAsado ? tamanoPorcion : undefined,
        estado: estadoComanda,
        tipo_pedido: tipoPedido,
        mesa: tipoPedido === 'mesa' ? mesa : undefined,
        direccion_domicilio: tipoPedido === 'domicilio' ? direccion : undefined,
        telefono_contacto: tipoPedido === 'domicilio' ? telefono : undefined,
        p_acompanamiento: acompLabel,
        p_con_ensalada: !currentItem.esBebida ? conEnsalada : false,
        p_con_salsas: !currentItem.esBebida ? conSalsas : false,
      });

      showNotification(result);

      if (result.ok) {
        setCantidad(1);
        if (tipoPedido === 'domicilio') {
          setDireccion('');
          setTelefono('');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la orden';
      showNotification({ ok: false, mensaje: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ultimasVentas = useMemo(() => {
    return ventas.slice(0, 15);
  }, [ventas]);

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Top Banner Grid */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Info Card */}
        <div className="md:col-span-2 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Menú Oficial de Precios y Caracterización</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-main)] tracking-tight">
              Toma y Gestión de Pedidos
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              Catálogo oficial: asados con tarifa por porción media/entera, almuerzos corrientes, secos y sopas con tarifa diferenciada (mesa / llevar), y bebidas personales y familiares.
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--border-soft)] flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
            <span>Asados: <strong>Media y Entera</strong></span>
            <span>·</span>
            <span>Almuerzos y Sopas: <strong>Tarifa Mesa y Llevar</strong></span>
            <span>·</span>
            <span>Bebidas: <strong>5 presentaciones oficiales</strong></span>
          </div>
        </div>

        {/* Featured Dish Visual Card */}
        <div className="relative rounded-2xl overflow-hidden border border-[var(--border-soft)] min-h-[170px] shadow-sm group">
          <img
            src={RESTAURANT_IMAGES.gourmetDish}
            alt="Plato seleccionado"
            className="w-full h-full object-cover object-center filter brightness-95 group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs">
              {currentItem?.categoria === 'asados' ? 'Asado a la Parrilla' : currentItem?.categoria === 'almuerzos_sopas' ? 'Almuerzo o Sopa' : 'Bebida'}
            </span>
            <div className="text-xs font-bold text-white mt-1 truncate">
              {currentItem ? currentItem.nombreVisible : 'Selecciona un producto'}
            </div>
            <p className="text-[10px] text-white/80 line-clamp-2 mt-0.5 leading-snug">
              {currentItem?.descripcion}
            </p>
            <div className="text-sm font-extrabold text-amber-400 font-mono mt-1">
              {formatCOP(unitPrice)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Order Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 sm:p-6 shadow-xs"
      >
        <div className="space-y-6">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Modalidad de Atención (En Mesa / A Domicilio / Para Llevar) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[var(--text-main)]">
                1. Modalidad de atención:
              </label>
              {currentItem?.esSopaOAlmuerzo && (
                <span className="text-[11px] text-[var(--brand-accent)] font-semibold">
                  Tarifa automática: {tipoPedido === 'mesa' ? 'Consumo en Mesa' : 'Para Llevar / Domicilio (+$1.000)'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setTipoPedido('mesa')}
                className={`py-3 px-3 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  tipoPedido === 'mesa'
                    ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-sm'
                    : 'bg-[var(--bg-main)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>En Mesa</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoPedido('domicilio')}
                className={`py-3 px-3 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  tipoPedido === 'domicilio'
                    ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-sm'
                    : 'bg-[var(--bg-main)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>A Domicilio</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoPedido('para_llevar')}
                className={`py-3 px-3 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  tipoPedido === 'para_llevar'
                    ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-sm'
                    : 'bg-[var(--bg-main)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                <span>Para Llevar</span>
              </button>
            </div>
          </div>

          {/* Datos específicos de modalidad */}
          {tipoPedido === 'mesa' && (
            <div className="p-3.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2">
              <label className="block text-xs font-bold text-[var(--text-main)]">
                Ubicación / Mesa:
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6', 'Mesa 7', 'Barra'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMesa(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      mesa === m
                        ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-xs'
                        : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipoPedido === 'domicilio' && (
            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--brand-accent)]">
                <span className="flex items-center gap-1.5">
                  <Bike className="w-4 h-4" />
                  <span>Datos de entrega a domicilio</span>
                </span>
                <span className="text-[10px] text-amber-500 font-semibold">
                  + Descuenta bolsa, cubiertos y empaque térmico o seco
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Dirección completa del cliente *"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
                  />
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Teléfono o WhatsApp de contacto"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
                  />
                </div>
              </div>
            </div>
          )}

          {tipoPedido === 'para_llevar' && (
            <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] text-xs text-[var(--text-muted)] flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Deducción automática: Contenedor térmico o empaque para secos y cubiertos desechables.</span>
            </div>
          )}

          {/* 2. Categorías y Catálogo del Menú */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-bold text-[var(--text-main)]">
                2. Productos y preparaciones del restaurante:
              </label>

              {/* Category Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-soft)] text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroCategoria('todos')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filtroCategoria === 'todos'
                      ? 'bg-[var(--brand-accent)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Todos ({MENU_OFICIAL_DOCUMENTO.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroCategoria('asados')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filtroCategoria === 'asados'
                      ? 'bg-[var(--brand-accent)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Asados ({MENU_OFICIAL_DOCUMENTO.filter((m) => m.categoria === 'asados').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroCategoria('almuerzos_sopas')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filtroCategoria === 'almuerzos_sopas'
                      ? 'bg-[var(--brand-accent)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Almuerzos y Sopas ({MENU_OFICIAL_DOCUMENTO.filter((m) => m.categoria === 'almuerzos_sopas').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroCategoria('bebidas')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    filtroCategoria === 'bebidas'
                      ? 'bg-[var(--brand-accent)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Bebidas ({MENU_OFICIAL_DOCUMENTO.filter((m) => m.categoria === 'bebidas').length})
                </button>
              </div>
            </div>

            {/* Grid of Dishes with Full Description */}
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {itemsVisibles.map((p) => {
                const isSelected = selectedPlatoId === p.plato;

                // Price display for the card
                let priceLabel = '';
                if (p.esAsado) {
                  priceLabel = `Media ${formatCOP(p.precioMedia || 0)} / Entera ${formatCOP(p.precioEntera || 0)}`;
                } else if (p.esSopaOAlmuerzo) {
                  priceLabel = `Mesa ${formatCOP(p.precioMesa || 0)} / Llevar ${formatCOP(p.precioLlevar || 0)}`;
                } else {
                  priceLabel = formatCOP(p.precioFijo || 0);
                }

                return (
                  <motion.button
                    key={p.plato}
                    variants={cardItemVariants}
                    whileHover={{ scale: 1.015, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setSelectedPlatoId(p.plato)}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[var(--brand-accent)]/10 border-[var(--brand-accent)] text-[var(--text-main)] shadow-xs ring-1 ring-[var(--brand-accent)]'
                        : 'bg-[var(--bg-main)] border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--brand-accent)]/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <span className="text-sm font-bold leading-snug text-[var(--text-main)]">
                          {p.nombreVisible}
                        </span>
                        {isSelected ? (
                          <span className="w-4 h-4 rounded-full bg-[var(--brand-accent)] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-[var(--border-soft)] shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-[var(--text-muted)] line-clamp-3 leading-relaxed mb-2">
                        {p.descripcion}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-soft)] flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 capitalize text-[var(--text-muted)]">
                        {p.categoria === 'almuerzos_sopas' ? 'Almuerzo / Sopa' : p.categoria}
                      </span>
                      <span className="text-xs font-extrabold text-[var(--brand-accent)] font-mono tabular-nums">
                        {priceLabel}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          {/* 3. Selector de Tamaño de Porción (Exclusivo para Asados) */}
          {currentItem?.esAsado && (
            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-main)]">
                  3. Tamaño de la porción del asado:
                </label>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Tarifas oficiales según el documento
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTamanoPorcion('media')}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                    tamanoPorcion === 'media'
                      ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-xs'
                      : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                  }`}
                >
                  <span>Porción Media</span>
                  <span className="font-mono">{formatCOP(currentItem.precioMedia || 0)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTamanoPorcion('entera')}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                    tamanoPorcion === 'entera'
                      ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-xs'
                      : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                  }`}
                >
                  <span>Porción Entera</span>
                  <span className="font-mono">{formatCOP(currentItem.precioEntera || 0)}</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. Pre-lista de Acompañamiento (Para comida) */}
          {!currentItem?.esBebida && (
            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-main)]">
                  4. Acompañamiento principal:
                </label>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Selección de 1 toque
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {ACOMPANAMIENTOS_PRESET.map((acomp) => {
                  const isSelected = selectedAcomp === acomp.id;
                  return (
                    <button
                      key={acomp.id}
                      type="button"
                      onClick={() => setSelectedAcomp(acomp.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-xs'
                          : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                      }`}
                    >
                      <span className="truncate">{acomp.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Complementos (Ensalada y Salsas) */}
          {!currentItem?.esBebida && (
            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-3">
              <label className="block text-xs font-bold text-[var(--text-main)]">
                5. Complementos de preparación:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setConEnsalada(!conEnsalada)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                    conEnsalada
                      ? 'bg-emerald-600/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                      : 'bg-[var(--bg-card)] border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Salad className="w-4 h-4" />
                    <span>Ensalada fresca</span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${conEnsalada ? 'bg-emerald-600 text-white' : 'bg-black/5 dark:bg-white/5'}`}>
                    {conEnsalada ? 'Incluida' : 'Sin ensalada'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setConSalsas(!conSalsas)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                    conSalsas
                      ? 'bg-amber-600/10 border-amber-500/50 text-amber-600 dark:text-amber-400'
                      : 'bg-[var(--bg-card)] border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4" />
                    <span>Salsas de la casa</span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${conSalsas ? 'bg-amber-600 text-white' : 'bg-black/5 dark:bg-white/5'}`}>
                    {conSalsas ? 'Incluidas' : 'Sin salsas'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 6. Cantidad de Unidades / Porciones */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-main)] mb-2">
              6. Cantidad solicitada:
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Quick chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[1, 2, 3, 4, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCantidad(num)}
                    className={`h-11 px-3.5 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                      cantidad === num
                        ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-xs'
                        : 'bg-[var(--bg-main)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                    }`}
                  >
                    {num} {num === 1 ? 'unidad' : 'unid.'}
                  </button>
                ))}
              </div>

              {/* Stepper */}
              <div className="inline-flex items-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setCantidad((prev) => Math.max(1, prev - 1))}
                  disabled={cantidad <= 1 || isSubmitting}
                  className="w-10 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors cursor-pointer"
                  aria-label="Disminuir cantidad"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isSubmitting}
                  className="w-14 text-center font-bold text-base text-[var(--text-main)] bg-transparent border-0 focus:outline-none font-mono tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setCantidad((prev) => prev + 1)}
                  disabled={isSubmitting}
                  className="w-10 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors cursor-pointer"
                  aria-label="Aumentar cantidad"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Summary */}
              <div className="flex-1 p-3 rounded-xl bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-[var(--text-muted)] block">Total a liquidar:</span>
                  <span className="font-semibold text-[var(--text-main)]">
                    {cantidad}x {currentItem ? currentItem.nombreVisible : ''} {currentItem?.esAsado ? `(${tamanoPorcion})` : ''}
                  </span>
                </div>
                <span className="text-xl sm:text-2xl font-extrabold text-[var(--brand-accent)] font-mono tabular-nums">
                  {formatCOP(totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* 7. Desglose en Tiempo Real de Deducciones de Inventario */}
          {recipeImpact.length > 0 && (
            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-main)]">
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-[var(--brand-accent)]" />
                  <span>Deducciones automáticas en inventario ({recipeImpact.length} insumos afectados)</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-normal">
                  Kardex en tiempo real
                </span>
              </div>

              <motion.div
                variants={fastStaggerContainerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-[var(--border-soft)] text-xs"
              >
                {recipeImpact.map((item, idx) => (
                  <motion.div
                    key={`${item.ingrediente}-${idx}`}
                    variants={listItemVariants}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-[var(--text-main)] truncate">
                        {capitalizeFirst(item.ingrediente)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[var(--text-muted)] font-medium">
                        {item.tipo}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">
                        (-{formatStock(item.cantidadTotal, item.unidad)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Stock: {formatStock(item.stockActual, item.unidad)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                      <span
                        className={`font-mono font-bold text-xs tabular-nums ${
                          item.isDeficit
                            ? 'text-rose-500'
                            : item.isCritical
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        Quedarán: {formatStock(item.stockRestante, item.unidad)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {hasInventoryDeficit && (
                <div className="pt-2 text-rose-500 text-xs font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Advertencia: Uno o más insumos quedarán en saldo cero o negativo.</span>
                </div>
              )}
            </div>
          )}

          {/* 8. Botones de Acción Inmediata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting || !currentItem}
              onClick={() => handleRegisterSale('pagado')}
              className="h-13 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando comanda...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Cobro Inmediato · {formatCOP(totalPrice)}</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isSubmitting || !currentItem}
              onClick={() => handleRegisterSale('en_cocina')}
              className="h-13 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando comanda...</span>
                </>
              ) : (
                <>
                  <UtensilsCrossed className="w-4 h-4 stroke-[2.5]" />
                  <span>Enviar a Cocina (Pendiente)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* 9. Historial de Comandas Activas */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.14 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--brand-accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Comandas Activas y Estado de Entrega
            </h3>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {ultimasVentas.length} órdenes registradas
          </span>
        </div>

        {ultimasVentas.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-xs">
            No se han registrado órdenes aún en la jornada.
          </div>
        ) : (
          <motion.div
            variants={fastStaggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-[var(--border-soft)] border border-[var(--border-soft)] rounded-xl overflow-hidden"
          >
            {ultimasVentas.map((venta) => {
              const estado = venta.estado || 'pagado';

              const getEstadoBadge = (st: EstadoComanda) => {
                switch (st) {
                  case 'en_cocina':
                  case 'nuevo':
                    return { label: 'En Cocina', bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' };
                  case 'en_camino':
                    return { label: 'En Camino (Moto)', bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' };
                  case 'listo':
                    return { label: 'Listo para Servir', bg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' };
                  case 'entregado':
                    return { label: 'Entregado', bg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' };
                  case 'pagado':
                  default:
                    return { label: 'Pagado', bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
                }
              };

              const badge = getEstadoBadge(estado);

              return (
                <motion.div
                  key={venta.id_operacion}
                  variants={tableRowVariants}
                  className="p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-main)] truncate">
                        {capitalizeFirst(venta.plato)} {venta.tamano_porcion ? `(${venta.tamano_porcion})` : ''}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border-soft)]">
                        {venta.tipo_pedido === 'domicilio' ? 'Domicilio' : venta.tipo_pedido === 'para_llevar' ? 'Para Llevar' : (venta.mesa || 'Mesa')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)] mt-1">
                      <span>{venta.cantidad} {venta.cantidad === 1 ? 'unidad' : 'unidades'}</span>
                      {venta.acompanamiento && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {venta.acompanamiento}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span className="font-mono text-[10px]">{venta.id_operacion}</span>
                      {venta.direccion_domicilio && (
                        <>
                          <span>·</span>
                          <span className="text-blue-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {venta.direccion_domicilio}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {/* Botones de cambio de estado interactivo */}
                    {estado !== 'pagado' && estado !== 'entregado' && (
                      <div className="flex items-center gap-1.5">
                        {estado === 'en_cocina' && venta.tipo_pedido === 'domicilio' && (
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(venta.id_operacion, 'en_camino')}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-colors cursor-pointer"
                            title="Despachar con motorizado"
                          >
                            Despachar
                          </button>
                        )}
                        {(estado === 'en_cocina' || estado === 'en_camino' || estado === 'listo') && (
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(venta.id_operacion, 'entregado')}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-colors cursor-pointer"
                            title="Confirmar entrega"
                          >
                            Entregado
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(venta.id_operacion, 'pagado')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                          title="Cobrar comanda"
                        >
                          Cobrar
                        </button>
                      </div>
                    )}

                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                        +{formatCOP(venta.total)}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {formatBogotaDateTime(venta.created_at || venta.fecha)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
