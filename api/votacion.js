// api/votacion.js
import { parseStringPromise } from 'xml2js';

export default async function handler(req, res) {
    const votacionId = req.query.id; 
    
    if (!votacionId) {
        return res.status(400).json({ error: 'Falta el ID de la votación' });
    }

    const url = `https://corsproxy.io/?https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/obtenerVotacionDetalle?prmVotacionId=${votacionId}`;

    try {
        const response = await fetch(url);

        if (!response.ok) throw new Error(`Error de la Cámara o del Proxy: ${response.status}`);
        
        const xmlData = await response.text();
        
        // --- NUEVA LÍNEA DE DETECTIVE ---
        // Vamos a imprimir los primeros 500 caracteres de lo que nos responde el servidor
        console.log("🔍 RESPUESTA CRUDA DEL SERVIDOR:", xmlData.substring(0, 500));
        // --------------------------------

        const result = await parseStringPromise(xmlData, { explicitArray: false });
        
        if (!result || !result.Votacion) {
             throw new Error("El XML recibido no tiene el formato esperado. Revisa los logs para ver la respuesta cruda.");
        }
        
        const detalle = result.Votacion; 
        
        let votosIndividuales = [];
        if (detalle.Votos && detalle.Votos.Voto) {
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
            detalleVotos: votosIndividuales
        };

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(datosLimpios);

    } catch (error) {
        console.error("Error en el backend:", error);
        res.status(500).json({ error: 'Hubo un problema procesando los datos', detalle: error.message });
    }
}
