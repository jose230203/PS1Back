require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(express.json());

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get('/', (req, res) => res.send("Nodo Lógica Managua - Operacional"));

app.post('/api/productos', async (req, res) => {
    const { nombre, precio, stock, creado_por, descripcion } = req.body;

    if (!nombre || precio <= 0) {
        return res.status(400).json({ error: "Datos inválidos: Nombre obligatorio y precio > 0" });
    }

    const { data, error } = await supabase
        .from('productos')
        .insert([{ nombre, precio, stock, creado_por, descripcion }])
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ mensaje: "Producto creado exitosamente", data: data[0] });
});

app.put('/api/productos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, precio, stock, descripcion, version_cliente, userId } = req.body;

    const { data: productoOriginal } = await supabase
        .from('productos')
        .select('creado_por')
        .eq('id', id)
        .single();

    if (!productoOriginal || productoOriginal.creado_por !== userId) {
        return res.status(403).json({ error: "No autorizado: Solo el creador puede modificar este recurso." });
    }

    const { data, error } = await supabase
        .from('productos')
        .update({ 
            nombre, precio, stock, descripcion,
            version: version_cliente + 1,
            ultima_modificacion: new Date() 
        })
        .match({ id, version: version_cliente })
        .select(); 

    if (error) return res.status(400).json({ error: error.message });
    res.json({ mensaje: "Actualizado con éxito", data: data[0] });
});

app.get('/api/productos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('productos')
            .select(`
                *,
                perfiles!productos_creado_por_fkey (
                    username
                )
            `)
            .eq('esta_activo', true)
            .order('id', { ascending: false });
        
        if (error) return res.status(200).json([]);

        const productosConUser = (data || []).map(p => ({
            ...p,
            creado_por_name: p.perfiles?.username || 'Sistema'
        }));

        res.json(productosConUser);
    } catch (e) {
        res.status(200).json([]); 
    }
});

app.patch('/api/productos/baja/:id', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body; 

    const { data: producto } = await supabase
        .from('productos')
        .select('creado_por')
        .eq('id', id)
        .single();

    if (!producto || producto.creado_por !== userId) {
        return res.status(403).json({ error: "Prohibido: No tienes permisos sobre este registro." });
    }

    const { error } = await supabase
        .from('productos')
        .update({ esta_activo: false })
        .eq('id', id);

    if (error) return res.status(400).json(error);
    res.json({ mensaje: "Baja lógica procesada" });
});


module.exports = app;