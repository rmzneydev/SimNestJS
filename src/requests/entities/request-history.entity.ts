import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { CommercialRequest } from './commercial-request.entity.js';

export type HistoryEventType = 'CREACION' | 'ESTADO' | 'ASIGNACION';

@Entity('solicitudes_historial')
@Index(['solicitud'])
@Index(['fechaEvento'])
export class RequestHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CommercialRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: CommercialRequest;

  @RelationId((evento: RequestHistory) => evento.solicitud)
  solicitudId: number;

  @Column()
  tipoEvento: HistoryEventType;

  @Column({ type: 'varchar', nullable: true })
  valorAnterior: string | null;

  @Column()
  valorNuevo: string;

  @Column()
  usuarioActor: string;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaEvento: Date;
}
