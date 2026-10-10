export type OpcionItem = {
  grupo: string;
  nombre: string;
  precio_extra: number;
};

export type Item = {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  pedido_item_opciones: OpcionItem[];
};

export type Pedido = {
  id: string;
  numero: number;
  estado: string;
  tipo_entrega: "domicilio" | "recoger";
  metodo_pago: string;
  estado_pago: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string | null;
  notas: string | null;
  total: number;
  creado_en: string;
  pedido_items: Item[];
};

export const COLUMNAS_PEDIDO =
  "id, numero, estado, tipo_entrega, metodo_pago, estado_pago, cliente_nombre, cliente_telefono, direccion, notas, total, creado_en, pedido_items(nombre, cantidad, precio_unitario, pedido_item_opciones(grupo, nombre, precio_extra))";

export const ETIQUETAS_ESTADO: Record<string, string> = {
  nuevo: "Nuevo",
  preparando: "Preparando",
  listo: "Listo",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ESTADOS_ACTIVOS = ["nuevo", "preparando", "listo", "en_camino"];