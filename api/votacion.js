// api/votacion.js
import { parseStringPromise } from 'xml2js';

export default async function handler(req, res) {
    // 1. Recibimos el ID dinámicamente desde el Frontend
    const votacionId = req.query.id; 
    
    if (!votacionId) {
        return res.status(400).json({ error: 'Falta el ID de la votación' });
    }

    const url = `http://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/obtenerVotacionDetalle?prmVotacionId=${votacionId}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al conectar con la Cámara');
        
        const xmlData = await response.text();
        const result = await parseStringPromise(xmlData, { explicitArray: false });
        const detalle = result.Votacion; 
        
        // 2. Extraemos el detalle individual de cada diputado
        let votosIndividuales = [];
        if (detalle.Votos && detalle.Votos.Voto) {
            // Aseguramos que sea un array por si xml2js lo parsea como objeto único
            const listaVotos = Array.isArray(detalle.Votos.Voto) ? detalle.Votos.Voto : [detalle.Votos.Voto];
            
            votosIndividuales = listaVotos.map(v => ({
                nombre: `${v.Diputado.Nombre} ${v.Diputado.ApellidoPaterno} ${v.Diputado.ApellidoMaterno || ''}`.trim(),
                opcion: v.OpcionVoto
            }));
        }
        
        const datosLimpios = {
            id: detalle.Id,
            descripcion: detalle.Descripcion,
            fecha: detalle.Fecha,
            resultados: {
                aFavor: parseInt(detalle.TotalAfavor) || 0,
                enContra: parseInt(detalle.TotalEnContra) || 0,
                abstenciones: parseInt(detalle.TotalAbstencion) || 0,
                pareos: parseInt(detalle.TotalDispensados) || 0 
            },
            detalleVotos: votosIndividuales // Añadimos la lista a la respuesta
        };

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(datosLimpios);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Hubo un problema procesando los datos' });
    }
}
