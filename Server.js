require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post('/productos', async (req, res) => {
    console.log("------------------------------------------");
    console.log("RECIBIENDO PETICIÓN POST EN NODO LÓGICA");
    const { nombre, precio, stock, creado_por, descripcion } = req.body;
    console.log("Datos:", { nombre, precio, stock, creado_por });

    if (!nombre || precio <= 0) {
        return res.status(400).json({ error: "Datos inválidos: Nombre obligatorio y precio > 0" });
    }

    const { data, error } = await supabase
        .from('productos')
        .insert([{ 
            nombre, 
            precio, 
            stock, 
            creado_por, 
            descripcion 
        }])
        .select();

    if (error) {
        console.error("Error en Supabase:", error);
        return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ mensaje: "Producto creado exitosamente", data: data[0] });
});

app.put('/productos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, precio, stock, descripcion, version_cliente, userId } = req.body;

    // 1. Verificamos quién es el dueño original en la base de datos
    const { data: productoOriginal } = await supabase
        .from('productos')
        .select('creado_por')
        .eq('id', id)
        .single();

    if (!productoOriginal || productoOriginal.creado_por !== userId) {
        return res.status(403).json({ error: "No autorizado: Solo el creador puede modificar este recurso." });
    }

    // 2. Si es el dueño, procedemos con el update
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
app.get('/productos', async (req, res) => {
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
        
        if (error) {
            console.error("Error en el JOIN de la base de datos:", error);
            return res.status(200).json([]);
        }

        const productosConUser = (data || []).map(p => ({
            ...p,
            creado_por_name: p.perfiles?.username || 'Sistema'
        }));

        res.json(productosConUser);
    } catch (e) {
        console.error("Falla crítica en el Nodo de Lógica:", e);
        res.status(200).json([]); 
    }
});

app.patch('/productos/baja/:id', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body; // Recibimos el userId desde el body del PATCH

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

const PORT = process.env.PORT_BACKEND || 3001;
app.listen(PORT, () => {
    console.log(`==========================================`);
    console.log(`SERVIDOR NODO LÓGICA: http://localhost:${PORT}`);
    console.log(`CONECTADO A: ${process.env.SUPABASE_URL}`);
    console.log(`==========================================`);
});